package com.Lsms;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.Lsms.Sales.config.MaterializedViewScheduler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * (dw) MaterializedViewScheduler on a REAL PostgreSQL (throwaway, empty DB, ddl-auto=update).
 * Calls the real scheduler bean method refreshSalesViews() exactly as the 01/03/05/23 cron does (no surrounding
 * transaction), then checks BOTH the log (no "Failed to refresh materialized views") AND the data: a sale inserted
 * after the view was built must appear in mv_daily_sales_summary and mv_monthly_sales_summary after the refresh.
 *
 *   mvnw test -Dtest=MvRefreshPgCheck -Dmv.pg.check=true -Dsurefire.failIfNoSpecifiedTests=false
 *     -DDB_URL=jdbc:postgresql://localhost:55499/Lsms -DDB_PASSWORD=...
 */
@SpringBootTest(properties = {
        "app.schedulers.enabled=false",
        "app.loans.interest-scheduler.enabled=false",
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=update",
        "spring.task.scheduling.enabled=false"})
@EnabledIfSystemProperty(named = "mv.pg.check", matches = "true")
class MvRefreshPgCheck {

    @Autowired ApplicationContext ctx;
    @Autowired JdbcTemplate jdbc;

    @Test
    void scheduledRefreshReallyRefreshes() {
        // the views exist (MaterializedViewInitializer ran on ApplicationReadyEvent)
        Integer mvs = jdbc.queryForObject(
                "SELECT count(*) FROM pg_matviews WHERE matviewname IN ('mv_daily_sales_summary','mv_monthly_sales_summary')",
                Integer.class);
        assertThat(mvs).as("views created").isEqualTo(2);

        LocalDate day = LocalDate.of(2031, 7, 15); // a date no other row uses
        insertSale(day);
        Integer before = jdbc.queryForObject(
                "SELECT count(*) FROM mv_daily_sales_summary WHERE sale_date = ?", Integer.class, day);
        assertThat(before).as("view is stale before refresh").isZero();

        Logger log = (Logger) LoggerFactory.getLogger(MaterializedViewScheduler.class);
        ListAppender<ILoggingEvent> app = new ListAppender<>();
        app.start();
        log.addAppender(app);
        try {
            // same bean the cron runs (constructed by Spring so @Autowired and any proxies apply)
            MaterializedViewScheduler sched = ctx.getAutowireCapableBeanFactory()
                    .createBean(MaterializedViewScheduler.class);
            sched.refreshSalesViews();
        } finally {
            log.detachAppender(app);
        }
        List<String> lines = new ArrayList<>();
        for (ILoggingEvent e : app.list) lines.add(e.getLevel() + " " + e.getFormattedMessage());
        System.out.println("MV_LOG " + lines);

        Integer daily = jdbc.queryForObject(
                "SELECT count(*) FROM mv_daily_sales_summary WHERE sale_date = ?", Integer.class, day);
        Integer monthly = jdbc.queryForObject(
                "SELECT count(*) FROM mv_monthly_sales_summary WHERE year = 2031 AND month = 7", Integer.class);
        System.out.println("MV_DATA daily=" + daily + " monthly=" + monthly);

        assertThat(app.list.stream().filter(e -> e.getLevel() == Level.ERROR).map(ILoggingEvent::getFormattedMessage)
                .collect(Collectors.toList())).as("no ERROR from the scheduler").isEmpty();
        assertThat(daily).as("mv_daily_sales_summary has the new day after refresh").isEqualTo(1);
        assertThat(monthly).as("mv_monthly_sales_summary has the new month after refresh").isEqualTo(1);
        System.out.println("MV_REFRESH_SAWA");
    }

    /** Inserts one STANDARD active sale; every other NOT NULL column without default gets a dummy by type. */
    private void insertSale(LocalDate day) {
        List<Map<String, Object>> cols = jdbc.queryForList("""
                SELECT column_name, data_type FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'sales'
                  AND is_nullable = 'NO' AND column_default IS NULL""");
        List<String> names = new ArrayList<>();
        List<Object> vals = new ArrayList<>();
        java.util.function.BiConsumer<String, Object> put = (n, v) -> {
            int i = names.indexOf(n);
            if (i >= 0) { vals.set(i, v); } else { names.add(n); vals.add(v); }
        };
        for (Map<String, Object> c : cols) {
            String n = (String) c.get("column_name");
            String t = (String) c.get("data_type");
            Object v;
            if (t.contains("char") || t.equals("text")) v = "mv-" + UUID.randomUUID().toString().substring(0, 8);
            else if (t.equals("boolean")) v = false;
            else if (t.startsWith("timestamp")) v = java.sql.Timestamp.valueOf(day.atTime(10, 0));
            else if (t.equals("date")) v = java.sql.Date.valueOf(day);
            else if (t.equals("uuid")) v = UUID.randomUUID();
            else v = 0;
            put.accept(n, v);
        }
        put.accept("uid", UUID.randomUUID().toString());
        put.accept("sale_date", java.sql.Timestamp.valueOf(day.atTime(10, 0)));
        put.accept("is_active", true);
        put.accept("is_deleted", false);
        put.accept("sale_source", "STANDARD");
        put.accept("total_amount", new java.math.BigDecimal("1000"));
        put.accept("total_profit", new java.math.BigDecimal("100"));
        String sql = "INSERT INTO sales (" + String.join(",", names) + ") VALUES ("
                + names.stream().map(x -> "?").collect(Collectors.joining(",")) + ")";
        // throwaway DB: skip FK triggers for the dummy row, on ONE connection
        jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) con -> {
            try (var st = con.createStatement()) { st.execute("SET session_replication_role = replica"); }
            try (var ps = con.prepareStatement(sql)) {
                for (int i = 0; i < vals.size(); i++) ps.setObject(i + 1, vals.get(i));
                ps.executeUpdate();
            }
            try (var st = con.createStatement()) { st.execute("SET session_replication_role = origin"); }
            return null;
        });
    }
}
