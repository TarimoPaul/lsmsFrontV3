#!/usr/bin/env python3
"""LSMS V3 auto-order (purchase suggestion) — Phase 1 backtest.  READ-ONLY, no prod code.

Runs the extraction queries in v3_order_backtest.sql against a LOCAL throw-away
postgres container holding a restored prod dump, then replays the suggestion formula
day by day using only the data that was known on each day.

    docker run -d --name lsms_order_bt -e POSTGRES_PASSWORD=bt -e POSTGRES_DB=lsms postgres:17
    docker cp <prod dump> lsms_order_bt:/tmp/prod.dump
    docker exec lsms_order_bt pg_restore -U postgres -d lsms --no-owner --no-privileges /tmp/prod.dump
    python analysis/v3_order_backtest.py            # full report to stdout + CSVs
    python analysis/v3_order_backtest.py --profile  # only the per-product classification profile

Standard library only (no pandas).
"""
import csv
import io
import math
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_FILE = os.path.join(HERE, "v3_order_backtest.sql")
CONTAINER = os.environ.get("LSMS_BT_CONTAINER", "lsms_order_bt")
DB = os.environ.get("LSMS_BT_DB", "lsms")
OUT = os.environ.get("LSMS_BT_OUT", os.path.join(HERE, "v3_order_backtest_out"))

HIST0 = date(2026, 2, 1)       # first day of sales history
D1 = date.fromisoformat(os.environ.get("LSMS_BT_END", "2026-09-29"))   # last full day in the dump
D0 = D1 - timedelta(days=59)   # backtest window (60 days)
ONE = timedelta(days=1)
DAYS = [D0 + timedelta(days=i) for i in range((D1 - D0).days + 1)]

# ---- classification rule (see v3_order_plan.md section 3) ---------------------------
C_ZERO_SHARE = 0.30     # counted 0 on >= 30% of count days  -> bought to order
C_MIN_SELL_DAYS = 0.50  # sold on < 50% of days               -> intermittent, no forecast
C_MIN_PACKS_14D = 1.0   # sells < 1 full pack per 14 days     -> pack rounding dominates
B_RESIDUAL = 0.30       # sum|count residual| / units sold    -> count data not trustworthy
C_NAME_HINTS = ("KUPIMA",)   # sold by measure: no unit sales recorded (owner decision 2026-10-04)
DELIVERY_HOUR = 13            # goods usually reach the shop about 13:00 (owner, 2026-10-04)

# ---- formula defaults -----------------------------------------------------------------
VELOCITY_DAYS = 14
VELOCITY_MAX_LOOKBACK = 28
DOW_WEEKS = 8
DOM_CLAMP = (0.85, 1.30)
PEAK_THRESHOLD = 1.08   # smoothed day-of-month factor that counts as "peak"
PEAK_PREP_DAYS = 3


# =======================================================================================
# data loading
# =======================================================================================
def run_queries():
    text = open(SQL_FILE, encoding="utf-8").read()
    parts = re.split(r"^-- @name:\s*(\w+)\s*$", text, flags=re.M)
    pre = "SET default_transaction_read_only = on; SET statement_timeout = '60s';\n"
    out = {}
    for name, sql in zip(parts[1::2], parts[2::2]):
        p = subprocess.run(
            ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", DB,
             "-q", "--csv", "-v", "ON_ERROR_STOP=1", "-v", f"d0={D0}", "-v", f"d1={D1}",
             "-v", f"d1next={D1 + ONE}"],
            input=pre + sql, capture_output=True, text=True, encoding="utf-8")
        if p.returncode != 0:
            sys.exit(f"query {name} failed: {p.stderr}")
        out[name] = list(csv.DictReader(io.StringIO(p.stdout)))
    return out


def d_(s):
    return date.fromisoformat(s[:10])


def f_(s):
    return float(s) if s not in ("", None) else 0.0


class Data:
    def __init__(self, q):
        self.products = {}
        for r in q["products"]:
            ppp = int(f_(r["ppp"]))
            cost = f_(r["avg_cost"]) or f_(r["last_cost"])
            self.products[r["uid"]] = dict(
                id=int(r["id"]), name=r["product_name"].strip(), category=r["category"],
                ppp=ppp if ppp > 1 else 1, ppp_known=ppp > 1, cost=cost,
                piece_price=f_(r["piece_price"]), crate_price=f_(r["crate_price"]))
        self.sales = defaultdict(dict)     # uid -> {date: pcs}
        self.rev = defaultdict(float)      # uid -> revenue in window
        self.cogs = defaultdict(float)
        for r in q["sales_daily"]:
            dt = d_(r["dt"])
            self.sales[r["product_uid"]][dt] = f_(r["pcs"])
            if D0 <= dt <= D1:
                self.rev[r["product_uid"]] += f_(r["rev"])
                self.cogs[r["product_uid"]] += f_(r["cost"])
        self.amt = {d_(r["dt"]): f_(r["amt"]) for r in q["store_daily"]}
        self.counts = defaultdict(dict)    # date -> {uid: (final, system)}
        self.count_status = {}
        for r in q["counts"]:
            dt = d_(r["dt"])
            self.counts[dt][r["product_uid"]] = (f_(r["final_qty"]), f_(r["system_qty"]))
            self.count_status[dt] = r["status"]
        self.purch = defaultdict(dict)     # uid -> {date: (pcs, value)}
        for r in q["purchases_daily"]:
            self.purch[r["product_uid"]][d_(r["dt"])] = (f_(r["pcs"]), f_(r["val"]))
        self.eod = defaultdict(list)       # uid -> sorted [(date, eod)]
        for r in q["store_eod"]:
            self.eod[r["product_uid"]].append((d_(r["dt"]), f_(r["eod"])))
        self.recon = {d_(r["dt"]): r for r in q["recon"]}
        self.monthly = defaultdict(float)  # (y, m) -> amount ; m=0 = every month of y
        for r in q["monthly_expenses"]:
            self.monthly[(int(r["y"]), int(r["m"]))] += f_(r["amount"])
        self.timing = [(r["product_uid"], d_(r["dt"]), f_(r["pcs_pre13"]), f_(r["pcs_timed"]), f_(r["pcs_all"]))
                       for r in q["sales_timing"]]
        self.suppliers = q["suppliers"]
        self.sessions = q["count_sessions"]
        self._fcache = {}

    # ---- primitives ---------------------------------------------------------------
    def sold(self, uid, dt):
        return max(self.sales[uid].get(dt, 0.0), 0.0)

    def count(self, uid, dt, approved_only=False):
        if approved_only and self.count_status.get(dt) != "APPROVED":
            return None
        c = self.counts.get(dt, {}).get(uid)
        return c[0] if c else None

    def bought(self, uid, dt):
        return self.purch[uid].get(dt, (0.0, 0.0))

    def system_eod(self, uid, dt):
        last = None
        for d, e in self.eod[uid]:
            if d > dt:
                break
            last = e
        return last

    def stockout(self, uid, dt):
        """Did the product close day `dt` with nothing on the shelf?
        Physical evidence first: next morning's count == 0. If there is no count the next
        morning, fall back to the system end-of-day balance <= 0."""
        c = self.count(uid, dt + ONE)
        if c is not None:
            return c <= 0
        e = self.system_eod(uid, dt)
        return e is not None and e <= 0

    # ---- seasonality factors, using only data before day D ------------------------
    def factors(self, D):
        if D in self._fcache:
            return self._fcache[D]
        hist = [(x, self.amt.get(x, 0.0)) for x in
                (HIST0 + timedelta(days=i) for i in range((D - HIST0).days))]
        # month normalisation removes the growth trend (21M Feb -> 35M Sep)
        by_month = defaultdict(list)
        for x, a in hist:
            by_month[(x.year, x.month)].append(a)
        trailing = [a for x, a in hist[-28:]]
        trail_avg = sum(trailing) / len(trailing)
        mavg = {m: (sum(v) / len(v) if len(v) >= 15 else trail_avg) for m, v in by_month.items()}
        norm = [(x, a / mavg[(x.year, x.month)]) for x, a in hist if a > 0 and mavg[(x.year, x.month)] > 0]
        # long-run day-of-week factor (only used to clean the day-of-month factor)
        s, n = defaultdict(float), defaultdict(int)
        for x, v in norm:
            s[x.weekday()] += v
            n[x.weekday()] += 1
        dow_long = {w: s[w] / n[w] for w in s}
        mean_long = sum(dow_long.values()) / len(dow_long)
        dow_long = {w: v / mean_long for w, v in dow_long.items()}
        # day-of-week factor from the last DOW_WEEKS weeks
        recent = hist[-7 * DOW_WEEKS:]
        s, n = defaultdict(float), defaultdict(int)
        for x, a in recent:
            s[x.weekday()] += a
            n[x.weekday()] += 1
        overall = sum(a for _, a in recent) / len(recent)
        dow = {w: (s[w] / n[w]) / overall for w in s}
        # day-of-month factor: month-normalised, day-of-week removed, 3-day smoothed
        s, n = defaultdict(float), defaultdict(int)
        for x, v in norm:
            s[x.day] += v / dow_long[x.weekday()]
            n[x.day] += 1
        dom = {}
        for dday in range(1, 32):
            nb = [(dday - 2) % 31 + 1, dday, dday % 31 + 1]
            tot, cnt = sum(s[k] for k in nb), sum(n[k] for k in nb)
            dom[dday] = tot / cnt if cnt else 1.0
        m = sum(dom[k] for k in range(1, 31)) / 30
        dom = {k: min(max(v / m, DOM_CLAMP[0]), DOM_CLAMP[1]) for k, v in dom.items()}
        # peak window = contiguous run >= PEAK_THRESHOLD around the best day
        best = max(range(1, 32), key=lambda k: dom[k])
        lo = hi = best
        while lo > 1 and dom[lo - 1] >= PEAK_THRESHOLD:
            lo -= 1
        while hi < 31 and dom[hi + 1] >= PEAK_THRESHOLD:
            hi += 1
        peak = (lo, hi, sum(dom[k] for k in range(lo, hi + 1)) / (hi - lo + 1)) if dom[best] >= PEAK_THRESHOLD else None
        res = dict(dow=dow, dom=dom, dow_long=dow_long, peak=peak)
        self._fcache[D] = res
        return res

    def product_dow(self, uid, D):
        s, n = defaultdict(float), defaultdict(int)
        tot = 0.0
        for i in range(1, 7 * DOW_WEEKS + 1):
            x = D - timedelta(days=i)
            v = self.sold(uid, x)
            s[x.weekday()] += v
            n[x.weekday()] += 1
            tot += v
        mean = tot / (7 * DOW_WEEKS)
        if mean <= 0:
            return None
        return {w: (s[w] / n[w]) / mean for w in s}

    def season(self, D, x, peak_prep=False, pdow=None):
        """factor for target day x, as estimated on day D"""
        f = self.factors(D)
        dow = (pdow or f["dow"]).get(x.weekday(), 1.0)
        dom = f["dom"][x.day]
        if peak_prep and f["peak"]:
            lo, _hi, level = f["peak"]
            gap = lo - D.day          # days until the peak starts, seen from order day D
            if 1 <= gap <= PEAK_PREP_DAYS:
                ramp = (PEAK_PREP_DAYS - gap + 1) / PEAK_PREP_DAYS
                dom = max(dom, 1 + (level - 1) * ramp)
        return dow * dom

    # ---- demand ------------------------------------------------------------------
    def velocity(self, uid, D):
        """Base (de-seasonalised) units/day from the 14 days before D.
        Stockout days are ADJUSTED, not dropped: their sales are floored at the average of
        the clean days (a day that sold out early cannot have had less demand than normal,
        and dropping it would throw away the busiest days). If fewer than 5 clean days exist
        in 14 days the window is extended back to 28 days to find them."""
        f = self.factors(D)
        days = [D - timedelta(days=k) for k in range(1, VELOCITY_DAYS + 1)]
        ds = lambda x: self.sold(uid, x) / max(f["dow"].get(x.weekday(), 1.0) * f["dom"][x.day], 0.3)
        so = {x: self.stockout(uid, x) for x in days}
        clean = [ds(x) for x in days if not so[x]]
        k = VELOCITY_DAYS
        while len(clean) < 5 and k < VELOCITY_MAX_LOOKBACK:
            k += 1
            x = D - timedelta(days=k)
            if not self.stockout(uid, x):
                clean.append(ds(x))
        n_so = sum(so.values())
        if not clean:
            vals = [ds(x) for x in days]
        else:
            floor = sum(clean) / len(clean)
            vals = [max(ds(x), floor) if so[x] else ds(x) for x in days]
        v = sum(vals) / len(vals)
        sd = math.sqrt(sum((a - v) ** 2 for a in vals) / (len(vals) - 1)) if len(vals) > 1 else 0.0
        return v, sd, n_so

    # ---- budget -------------------------------------------------------------------
    def accrual_per_day(self, D):
        """monthly expenses per day, from the PREVIOUS calendar month (known on day D)"""
        y, m = (D.year, D.month - 1) if D.month > 1 else (D.year - 1, 12)
        days = (date(D.year, D.month, 1) - date(y, m, 1)).days
        return (self.monthly.get((y, m), 0.0) + self.monthly.get((y, 0), 0.0)) / days

    def budget(self, D):
        """cash produced by the previous business day, from its reconciliation"""
        r = self.recon.get(D - ONE)
        if not r:
            return None
        received = f_(r["total_sales"]) - f_(r["unpaid_debts"]) - f_(r["returns_ded"])
        coll = max(f_(r["cash_debt"]) + f_(r["bank_debt"]) + f_(r["mobile_debt"]), f_(r["debt_coll_system"]))
        acc = self.accrual_per_day(D)
        return dict(received=received, collections=coll, expenses=f_(r["expenses"]), accrual=acc,
                    budget=received + coll - f_(r["expenses"]) - acc, status=r["status"],
                    approved_at=r["approved_at"], submitted_at=r["submitted_at"])


# =======================================================================================
# classification
# =======================================================================================
def profile(data):
    rows = {}
    count_days = [d for d in DAYS if data.count_status.get(d) == "APPROVED"]
    for uid, p in data.products.items():
        sold = sum(data.sold(uid, d) for d in DAYS)
        sell_days = sum(1 for d in DAYS if data.sold(uid, d) > 0)
        cd = [d for d in count_days if data.count(uid, d) is not None]
        zero = sum(1 for d in cd if data.count(uid, d) <= 0)
        # count consistency: count(D+1) should equal count(D) + bought(D) - sold(D)
        resid_abs = resid_net = flow_sold = 0.0
        pairs = 0
        for d in DAYS:
            a, b = data.count(uid, d), data.count(uid, d + ONE)
            if a is None or b is None:
                continue
            r = b - (a + data.bought(uid, d)[0] - data.sold(uid, d))
            resid_abs += abs(r)
            resid_net += r
            flow_sold += data.sold(uid, d)
            pairs += 1
        bought = sum(data.bought(uid, d)[0] for d in DAYS)
        buys = sum(1 for d in DAYS if data.bought(uid, d)[0] > 0)
        packs14 = sold / len(DAYS) * 14 / p["ppp"]
        zero_share = zero / len(cd) if cd else None
        resid_ratio = (resid_abs / flow_sold) if flow_sold > 0 else (float("inf") if resid_abs > 0 else 0.0)
        hint = any(h in p["name"].upper() for h in C_NAME_HINTS)
        reasons = []
        if hint:
            cls, reasons = "C", ["KUPIMA"]
        elif sold <= 0 and bought <= 0:
            cls = "-"                       # nothing sold or bought in the window: not listed
        else:
            if zero_share is not None and zero_share >= C_ZERO_SHARE:
                reasons.append(f"stock 0 siku {zero_share:.0%}")
            if sell_days / len(DAYS) < C_MIN_SELL_DAYS:
                reasons.append(f"inauzwa siku {sell_days}/{len(DAYS)}")
            if packs14 < C_MIN_PACKS_14D:
                reasons.append(f"pakiti {packs14:.2f}/siku 14")
            if reasons:
                cls = "C"
            else:
                breasons = []
                if resid_ratio > B_RESIDUAL:
                    breasons.append(f"hesabu hailingani {min(resid_ratio, 9.99):.0%} ya mauzo")
                cls = "B" if breasons else "A"
                reasons = breasons
        rows[uid] = dict(uid=uid, id=p["id"], name=p["name"], category=p["category"], ppp=p["ppp"],
                         ppp_known=p["ppp_known"], cls=cls, sold=sold, per_day=sold / len(DAYS),
                         sell_days=sell_days, zero_share=zero_share, resid_ratio=resid_ratio,
                         resid_abs=resid_abs, resid_net=resid_net, pairs=pairs, bought=bought, buys=buys,
                         packs14=packs14, cost=p["cost"],
                         margin=(data.rev[uid] - data.cogs[uid]) / sold if sold > 0 else 0.0,
                         gp=data.rev[uid] - data.cogs[uid], reasons="; ".join(reasons))
    return rows


# =======================================================================================
# suggestion + simulation
# =======================================================================================
class Params:
    def __init__(self, cover_a=2.0, cover_b=3.0, z=0.0, formula="tomorrow", peak_prep=True,
                 budget="none", prod_dow=(), same_day=True, pool_cap=None, b_cycle=1, pre_share=0.0):
        self.cover = {"A": cover_a, "B": cover_b}
        self.z, self.formula, self.peak_prep = z, formula, peak_prep
        # budget: "none" | "day" (each day's cash only, leftover not reusable)
        #         | "pool" (leftover stays as cash and is still there for the next order)
        # pool_cap: the most unspent cash that may be carried to the next day (None = no limit)
        self.budget, self.prod_dow, self.same_day, self.pool_cap = budget, set(prod_dow), same_day, pool_cap
        # b_cycle: class B (agent-delivered sodas) can only be ordered every b_cycle days
        # pre_share: share of the day's demand that must be served from the morning stock
        self.b_cycle, self.pre_share = b_cycle, pre_share

    def label(self):
        return (f"A{self.cover['A']:g}/B{self.cover['B']:g} z={self.z:g} {self.formula}"
                f"{' +peak' if self.peak_prep else ''} budget={self.budget}"
                f"{'' if self.pool_cap is None else f'<={self.pool_cap / 1e6:g}M'}"
                f"{'' if self.same_day else ' next-day'}{'' if self.b_cycle == 1 else f' Bcycle={self.b_cycle}'}"
                f"{'' if not self.pre_share else ' pre=measured' if isinstance(self.pre_share, dict) else f' pre={self.pre_share:g}'}")


def suggest(data, uid, cls, D, stock, P):
    """the formula under test, for order day D (count taken that morning)"""
    p = data.products[uid]
    v, sd, n_so = data.velocity(uid, D)
    cover = P.cover[cls]
    pdow = data.product_dow(uid, D) if uid in P.prod_dow else None
    if P.formula == "tomorrow":
        # owner's formula: velocity x factor(tomorrow) x cover_days
        fac = data.season(D, D + ONE, P.peak_prep, pdow)
        demand = v * fac * cover
    else:
        # per-day sum: today (the count is taken in the morning) + the following days
        demand, left, k = 0.0, cover, 0
        fac = data.season(D, D + ONE, P.peak_prep, pdow)
        while left > 1e-9:
            w = min(1.0, left)
            demand += w * v * data.season(D, D + timedelta(days=k), P.peak_prep, pdow)
            left -= w
            k += 1
    ss = P.z * sd * math.sqrt(cover)
    target = demand + ss
    need = max(0.0, target - stock)
    packs = math.ceil(need / p["ppp"] - 1e-9) if need > 0 else 0
    return dict(v=v, sd=sd, n_so=n_so, factor=fac, target=target, need=need, packs=packs,
                units=packs * p["ppp"], cost=packs * p["ppp"] * p["cost"])


def apply_budget(data, prof, orders, limit):
    """highest velocity first, margin as tie-break; whatever does not fit is cut (whole packs)"""
    cuts = []
    left = limit
    for uid in sorted(orders, key=lambda u: (-orders[u]["v"], -prof[u]["margin"])):
        o = orders[uid]
        if o["packs"] == 0:
            continue
        pack_cost = data.products[uid]["ppp"] * data.products[uid]["cost"]
        fit = o["packs"] if pack_cost <= 0 else min(o["packs"], int(max(left, 0) // pack_cost))
        if fit < o["packs"]:
            cuts.append((uid, o["packs"] - fit, (o["packs"] - fit) * pack_cost))
            o["packs"], o["units"], o["cost"] = fit, fit * data.products[uid]["ppp"], fit * pack_cost
        left -= o["cost"]
    return cuts


def simulate(data, prof, P, keep_daily=False):
    """Rolling replay: stock evolves under the SUGGESTED orders, demand = the units actually sold.
    Assumption: goods fetched on day D are on the shelf for day D's sales (same-day restock)."""
    sim = [u for u, r in prof.items() if r["cls"] in ("A", "B")]
    stock = {}
    for u in sim:
        c = data.count(u, D0)
        stock[u] = c if c is not None else 0.0
    res = {u: dict(order_units=0.0, order_cost=0.0, lost=0.0, so_days=0, strict_days=0, stock_sum=0.0,
                   stock_days=0, peak_stock_sum=0.0, order_days=0, cut_days=0, cut_value=0.0) for u in sim}
    daily, events = [], []
    pool = 0.0
    for D in DAYS:
        orders = {u: suggest(data, u, prof[u]["cls"], D, stock[u], P) for u in sim}
        if P.b_cycle > 1 and (D - D0).days % P.b_cycle:
            for u in sim:
                if prof[u]["cls"] == "B":
                    orders[u].update(packs=0, units=0, cost=0.0)
        b = data.budget(D)
        want = sum(o["cost"] for o in orders.values())
        cuts, limit = [], None
        if P.budget != "none" and b is not None:
            # manual / class C purchases come out of the same cash first
            other = sum(v for u in data.products if u not in orders
                        for (_p, v) in [data.bought(u, D)])
            limit = b["budget"] - other + (pool if P.budget == "pool" else 0.0)
            if want > limit:
                cuts = apply_budget(data, prof, orders, limit)
            pool = max(limit - sum(o["cost"] for o in orders.values()), 0.0)
            if P.pool_cap is not None:
                pool = min(pool, P.pool_cap)
        for u, n, val in cuts:
            res[u]["cut_days"] += 1
            res[u]["cut_value"] += val
        measured = data.count_status.get(D) == "APPROVED"
        for u in sim:
            o, r = orders[u], res[u]
            dem = data.sold(u, D)
            if measured:
                r["stock_sum"] += stock[u]
                r["stock_days"] += 1
                r["peak_stock_sum"] += stock[u] + o["units"]
            if dem > stock[u] + 1e-9:
                r["strict_days"] += 1            # needed the same-day delivery to serve the day
            # same_day=False: today's goods only reach the shelf after today's sales
            avail = stock[u] + (o["units"] if P.same_day else 0.0)
            pre = (P.pre_share.get(D.weekday(), 0.0) if isinstance(P.pre_share, dict) else P.pre_share) * dem
            sold = min(stock[u], pre) + min(avail - min(stock[u], pre), dem - pre)
            if dem > sold + 1e-9:
                avail = sold
                r["so_days"] += 1
                r["lost"] += dem - avail
                events.append(dict(date=D, uid=u, demand=dem, stock=stock[u], order=o["units"], v=o["v"],
                                   target=o["target"], cut=any(c[0] == u for c in cuts)))
            r["order_units"] += o["units"]
            r["order_cost"] += o["cost"]
            r["order_days"] += 1 if o["units"] > 0 else 0
            stock[u] = stock[u] + o["units"] - sold
        if keep_daily:
            daily.append(dict(date=D, budget=b["budget"] if b else None, limit=limit, wanted=want,
                              ordered=sum(o["cost"] for o in orders.values()),
                              cut=sum(c[2] for c in cuts), cut_items=len(cuts), pool_after=pool,
                              actual=sum(data.bought(u, D)[1] for u in sim),
                              actual_all=sum(data.bought(u, D)[1] for u in data.products),
                              recon_status=b["status"] if b else "HAKUNA"))
    for u in sim:
        res[u]["end_stock"] = stock[u]
    if keep_daily == "events":
        return res, daily, events
    return res, daily


def actuals(data, prof):
    """what really happened in the window, per forecast product"""
    out = {}
    measured = [d for d in DAYS if data.count_status.get(d) == "APPROVED"]
    for u, r in prof.items():
        if r["cls"] not in ("A", "B"):
            continue
        cost = data.products[u]["cost"]
        st = [data.count(u, d) for d in measured if data.count(u, d) is not None]
        pk = [data.count(u, d) + data.bought(u, d)[0] for d in measured if data.count(u, d) is not None]
        end = data.count(u, D1 + ONE)
        out[u] = dict(
            buy_units=sum(data.bought(u, d)[0] for d in DAYS),
            buy_value=sum(data.bought(u, d)[1] for d in DAYS),
            buy_cost_basis=sum(data.bought(u, d)[0] for d in DAYS) * cost,
            buy_days=sum(1 for d in DAYS if data.bought(u, d)[0] > 0),
            so_days=sum(1 for d in DAYS if data.stockout(u, d)),
            strict_days=sum(1 for d in measured if data.count(u, d) is not None and data.sold(u, d) > data.count(u, d)),
            measured_days=len(st),
            stock_avg=sum(st) / len(st) if st else 0.0,
            peak_avg=sum(pk) / len(pk) if pk else 0.0,
            end_stock=end if end is not None else 0.0)
    return out


def one_step(data, prof, P):
    """Every approved-count day on its own: suggestion from the REAL count vs the real purchase."""
    out = {}
    for u, r in prof.items():
        if r["cls"] not in ("A", "B"):
            continue
        a = dict(days=0, sug_units=0.0, act_units=0.0, sug_days=0, act_days=0, short=0, act_short=0,
                 more=0, less=0, same=0)
        for D in DAYS:
            c = data.count(u, D, approved_only=True)
            if c is None:
                continue
            o = suggest(data, u, r["cls"], D, c, P)
            act = data.bought(u, D)[0]
            dem = data.sold(u, D)
            a["days"] += 1
            a["sug_units"] += o["units"]
            a["act_units"] += act
            a["sug_days"] += o["units"] > 0
            a["act_days"] += act > 0
            a["short"] += dem > c + o["units"] + 1e-9
            a["act_short"] += dem > c + act + 1e-9   # impossible in reality -> data inconsistency
            ap = act / r["ppp"]
            a["more"] += o["packs"] > ap + 1e-9
            a["less"] += o["packs"] < ap - 1e-9
            a["same"] += abs(o["packs"] - ap) <= 1e-9
        out[u] = a
    return out


def pre_delivery_share(data, prof, cls="A"):
    """share of class units entered before DELIVERY_HOUR, per weekday (see sales_timing in the SQL)"""
    pre, timed, total = defaultdict(float), defaultdict(float), defaultdict(float)
    for u, dt, a, b, c in data.timing:
        if prof[u]["cls"] != cls:
            continue
        w = dt.weekday()
        pre[w] += a
        timed[w] += b
        total[w] += c
    rows = {w: dict(pre=pre[w], timed=timed[w], total=total[w],
                    share=pre[w] / timed[w] if timed[w] else 0.0,
                    untimed=1 - timed[w] / total[w] if total[w] else 0.0) for w in range(7)}
    rows["all"] = dict(pre=sum(pre.values()), timed=sum(timed.values()), total=sum(total.values()),
                       share=sum(pre.values()) / sum(timed.values()),
                       untimed=1 - sum(timed.values()) / sum(total.values()))
    return rows


def night_test(data, prof, P):
    """Suggestion computed the NIGHT BEFORE (after closing day D-1) from
    count(D-1) + bought(D-1) - sold(D-1), against the one computed from the morning count of D.
    Same sales history in both; only the stock figure differs."""
    out = {}
    for u, r in prof.items():
        if r["cls"] not in ("A", "B"):
            continue
        a = dict(days=0, same=0, night_more=0, night_less=0, abs_packs=0.0, night_cost=0.0, morn_cost=0.0,
                 short_night=0, short_morn=0, abs_stock=0.0)
        for D in DAYS:
            c, prev = data.count(u, D, approved_only=True), data.count(u, D - ONE)
            if c is None or prev is None:
                continue
            est = max(prev + data.bought(u, D - ONE)[0] - data.sold(u, D - ONE), 0.0)
            n, m = suggest(data, u, r["cls"], D, est, P), suggest(data, u, r["cls"], D, c, P)
            dem = data.sold(u, D)
            a["days"] += 1
            a["same"] += n["packs"] == m["packs"]
            a["night_more"] += n["packs"] > m["packs"]
            a["night_less"] += n["packs"] < m["packs"]
            a["abs_packs"] += abs(n["packs"] - m["packs"])
            a["abs_stock"] += abs(est - c)
            a["night_cost"] += n["cost"]
            a["morn_cost"] += m["cost"]
            a["short_night"] += dem > c + n["units"] + 1e-9     # real stock is the morning count
            a["short_morn"] += dem > c + m["units"] + 1e-9
        out[u] = a
    return out


def slow_movers(data, prof):
    """stock that does not move: class C and products with no sale/purchase in the window"""
    last_count = max(d for d in data.counts if d <= D1 + ONE)
    rows = []
    for u, r in prof.items():
        if r["cls"] not in ("C", "-"):
            continue
        qty = data.count(u, last_count)
        if qty is None or qty <= 0:
            continue
        sales = [d for d, v in data.sales[u].items() if v > 0 and d <= D1]
        last_sale = max(sales) if sales else None
        days_since = (D1 - last_sale).days if last_sale else None
        s30 = sum(data.sold(u, D1 - timedelta(days=i)) for i in range(30))
        s60 = sum(data.sold(u, D1 - timedelta(days=i)) for i in range(60))
        cover = qty / (s60 / 60) if s60 > 0 else None
        if s60 == 0:
            action = "rudisha / punguza bei; acha kuagiza"
        elif cover > 120:
            action = "punguza bei; acha kuagiza"
        elif cover > 45:
            action = "acha kuagiza hadi stock ishuke"
        else:
            action = "sawa"
        rows.append(dict(id=r["id"], name=r["name"], category=r["category"], cls=r["cls"], qty=qty, cost=r["cost"],
                         value=qty * r["cost"], last_sale=last_sale, days_since=days_since, sold30=s30, sold60=s60,
                         cover_days=cover, action=action))
    return sorted(rows, key=lambda x: -x["value"]), last_count


def dow_test(data, prof, top):
    """one-day-ahead forecast error for the top products: store factor vs own factor vs none"""
    rows = []
    for u in top:
        e_none = e_store = e_long = e_own = 0.0
        n = 0
        for D in DAYS:
            if data.stockout(u, D):
                continue
            v, _sd, _n = data.velocity(u, D)
            f = data.factors(D)
            own = data.product_dow(u, D) or {}
            act = data.sold(u, D)
            e_none += abs(act - v * f["dom"][D.day])
            e_store += abs(act - v * f["dom"][D.day] * f["dow"].get(D.weekday(), 1.0))
            e_long += abs(act - v * f["dom"][D.day] * f["dow_long"].get(D.weekday(), 1.0))
            e_own += abs(act - v * f["dom"][D.day] * own.get(D.weekday(), 1.0))
            n += 1
        rows.append(dict(uid=u, n=n, none=e_none / n, store=e_store / n, long=e_long / n, own=e_own / n,
                         mean=sum(data.sold(u, D) for D in DAYS) / len(DAYS)))
    return rows


# =======================================================================================
# reporting
# =======================================================================================
def money(x):
    return f"{x:,.0f}"


def write_csv(name, rows, cols):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(cols)
        for r in rows:
            w.writerow([r.get(c, "") for c in cols])


def totals(data, prof, res, act, cls=None):
    us = [u for u in res if cls is None or prof[u]["cls"] == cls]
    cost = lambda u: data.products[u]["cost"]
    return dict(
        n=len(us),
        sim_so=sum(res[u]["so_days"] for u in us),
        act_so=sum(act[u]["so_days"] for u in us),
        lost_value=sum(res[u]["lost"] * (cost(u) + prof[u]["margin"]) for u in us),
        sim_stock=sum(res[u]["stock_sum"] / max(res[u]["stock_days"], 1) * cost(u) for u in us),
        act_stock=sum(act[u]["stock_avg"] * cost(u) for u in us),
        sim_peak=sum(res[u]["peak_stock_sum"] / max(res[u]["stock_days"], 1) * cost(u) for u in us),
        act_peak=sum(act[u]["peak_avg"] * cost(u) for u in us),
        sim_buy=sum(res[u]["order_cost"] for u in us),
        act_buy=sum(act[u]["buy_cost_basis"] for u in us),
        sim_end=sum(res[u]["end_stock"] * cost(u) for u in us),
        act_end=sum(act[u]["end_stock"] * cost(u) for u in us),
        cut_value=sum(res[u]["cut_value"] for u in us),
        sim_strict=sum(res[u]["strict_days"] for u in us),
        act_strict=sum(act[u]["strict_days"] for u in us))


def main():
    data = Data(run_queries())
    prof = profile(data)
    listed = sorted((r for r in prof.values() if r["cls"] != "-"), key=lambda r: -r["sold"])

    print(f"== CLASSIFICATION  (window {D0}..{D1}, {len(DAYS)} days; approved count days: "
          f"{sum(1 for d in DAYS if data.count_status.get(d) == 'APPROVED')})")
    print(f"{'id':>4} {'product':28} {'cat':8} {'cls':3} {'ppp':>3} {'sold':>6} {'/day':>6} {'sell_d':>6} "
          f"{'zero%':>6} {'resid%':>7} {'net_res':>7} {'buys':>4} {'pk/14d':>6}  reasons")
    for r in listed:
        z = f"{r['zero_share']:.0%}" if r["zero_share"] is not None else "-"
        rr = "inf" if r["resid_ratio"] == float("inf") else f"{r['resid_ratio']:.0%}"
        print(f"{r['id']:>4} {r['name'][:28]:28} {r['category'][:8]:8} {r['cls']:3} {r['ppp']:>3} {r['sold']:>6.0f} "
              f"{r['per_day']:>6.1f} {r['sell_days']:>6} {z:>6} {rr:>7} {r['resid_net']:>7.0f} {r['buys']:>4} "
              f"{r['packs14']:>6.2f}  {r['reasons']}")
    for c in "ABC":
        rs = [r for r in listed if r["cls"] == c]
        tot_gp = sum(r["gp"] for r in listed) or 1
        print(f"class {c}: {len(rs)} products, {sum(r['sold'] for r in rs):,.0f} pcs, "
              f"GP share {sum(r['gp'] for r in rs) / tot_gp:.1%}")
    write_csv("classes.csv", listed, ["id", "uid", "name", "category", "cls", "ppp", "ppp_known", "sold", "per_day",
                                      "sell_days", "zero_share", "resid_ratio", "resid_net", "bought", "buys",
                                      "packs14", "cost", "margin", "gp", "reasons"])
    if "--profile" in sys.argv:
        return

    act = actuals(data, prof)
    top20 = [r["uid"] for r in listed if r["cls"] in ("A", "B")][:20]

    # ---- factors as estimated on the last day ---------------------------------------
    f = data.factors(D1 + ONE)
    names = ["Jtt", "Jnn", "Jtn", "Alh", "Ijm", "Jms", "Jpl"]
    print("\n== FACTORS (as of", D1 + ONE, ")")
    print("dow 8wk :", "  ".join(f"{names[w]} {f['dow'][w]:.2f}" for w in range(7)))
    print("dow long:", "  ".join(f"{names[w]} {f['dow_long'][w]:.2f}" for w in range(7)))
    print("dom     :", "  ".join(f"{k}:{f['dom'][k]:.2f}" for k in range(1, 32)))
    print("peak    :", f["peak"])
    for D in (D0, D0 + timedelta(days=20), D0 + timedelta(days=40)):
        ff = data.factors(D)
        print(f"  as of {D}: peak={ff['peak']}  dow=" + " ".join(f"{ff['dow'][w]:.2f}" for w in range(7)))

    # ---- per-product day-of-week test -------------------------------------------------
    print("\n== DOW TEST top 20 (mean abs error, pcs/day): mean sales | no factor | store 8wk | store long-run | own 8wk")
    stable = []
    for r in dow_test(data, prof, top20):
        better = r["own"] < r["store"] * 0.95
        if better:
            stable.append(r["uid"])
        print(f"{prof[r['uid']]['id']:>4} {prof[r['uid']]['name'][:26]:26} n={r['n']:>2} {r['mean']:>6.1f} | {r['none']:>6.1f} | "
              f"{r['store']:>6.1f} | {r['long']:>6.1f} | {r['own']:>6.1f} {'<- own better' if better else ''}")

    # ---- parameter grid --------------------------------------------------------------
    print("\n== GRID (rolling simulation, peak prep on)")
    hdr = (f"{'config':44} {'cls':3} {'so_sim':>6} {'so_act':>6} {'lost_val':>10} {'stock_sim':>10} {'stock_act':>10} "
           f"{'buy_sim':>11} {'buy_act':>11} {'end_sim':>9} {'end_act':>9} {'cut':>9}")
    print(hdr)
    grid_rows = []
    configs = []
    for formula in ("tomorrow", "sum"):
        for ca, cb in ((1.0, 1.5), (1.5, 2.0), (2.0, 3.0), (3.0, 4.0)):
            for z in (0.0, 0.5, 1.0):
                configs.append(Params(ca, cb, z, formula))
    for ca, cb, z in ((2.0, 3.0, 0.25), (2.0, 3.0, 0.75)):
        configs.append(Params(ca, cb, z, "tomorrow"))
    for z in (0.0, 0.5):
        for bm, cap in (("day", None), ("pool", 500_000), ("pool", 1_000_000), ("pool", None)):
            configs.append(Params(2.0, 3.0, z, "tomorrow", budget=bm, pool_cap=cap))
    for P in configs:
        res, _ = simulate(data, prof, P)
        for c in ("A", "B"):
            t = totals(data, prof, res, act, c)
            grid_rows.append(dict(config=P.label(), cls=c, **t))
            print(f"{P.label():44} {c:3} {t['sim_so']:>6} {t['act_so']:>6} {money(t['lost_value']):>10} "
                  f"{money(t['sim_stock']):>10} {money(t['act_stock']):>10} {money(t['sim_buy']):>11} "
                  f"{money(t['act_buy']):>11} {money(t['sim_end']):>9} {money(t['act_end']):>9} {money(t['cut_value']):>9}")
    write_csv("grid.csv", grid_rows, ["config", "cls", "n", "sim_so", "act_so", "lost_value", "sim_stock", "act_stock",
                                      "sim_peak", "act_peak", "sim_buy", "act_buy", "sim_end", "act_end", "cut_value",
                                      "sim_strict", "act_strict"])

    # ---- variants around the owner's default -------------------------------------------
    print("\n== VARIANTS")
    dec = dict(z=0.5, formula="tomorrow", budget="pool", pool_cap=1_000_000)   # owner decisions 2026-10-04
    pds = pre_delivery_share(data, prof)
    measured = {w: pds[w]["share"] for w in range(7)}
    wd = ["Jtt", "Jnn", "Jtn", "Alh", "Ijm", "Jms", "Jpl"]
    print(f"\n== CLASS A UNITS ENTERED BEFORE {DELIVERY_HOUR}:00 (entry time = lower bound of real share)")
    for w in list(range(7)) + ["all"]:
        r = pds[w]
        print(f"{wd[w] if w != 'all' else 'zote':5} before13={r['pre']:>7.0f} timed={r['timed']:>7.0f} all={r['total']:>7.0f} "
              f"share={r['share']:.1%} no-timing={r['untimed']:.1%}")
    variants = [
        ("DECIDED: A2 z0.5, pool<=1M, B daily cover 3", Params(2.0, 3.0, **dec)),
        ("  no peak prep", Params(2.0, 3.0, peak_prep=False, **dec)),
        ("  MEASURED share sold before delivery", Params(2.0, 3.0, pre_share=measured, **dec)),
        ("  twice the measured share", Params(2.0, 3.0, pre_share={w: min(2 * v, 1.0) for w, v in measured.items()}, **dec)),
        ("  measured share, z 0.75", Params(2.0, 3.0, pre_share=measured, **dict(dec, z=0.75))),
        ("  measured share, cap 1.5M", Params(2.0, 3.0, pre_share=measured, **dict(dec, pool_cap=1_500_000))),
        ("  goods arrive after the day's sales", Params(2.0, 3.0, same_day=False, **dec)),
        ("  B every 6 days, cover 7", Params(2.0, 7.0, b_cycle=6, **dec)),
        ("  B every 6 days, cover 8, cap 1.5M", Params(2.0, 8.0, b_cycle=6, **dict(dec, pool_cap=1_500_000))),
        ("  same + measured share", Params(2.0, 8.0, b_cycle=6, pre_share=measured, **dict(dec, pool_cap=1_500_000))),
    ]
    for label, P in variants:
        res, _ = simulate(data, prof, P)
        t = totals(data, prof, res, act)
        tb = totals(data, prof, res, act, "B")
        label = f"{label} [B so={tb['sim_so']} stock={money(tb['sim_stock'])}]"
        print(f"{label:75} so={t['sim_so']:>3} (act {t['act_so']}) lost={money(t['lost_value']):>9} "
              f"stock={money(t['sim_stock']):>9} (act {money(t['act_stock'])}) peak={money(t['sim_peak']):>9} "
              f"(act {money(t['act_peak'])}) buy={money(t['sim_buy'])} (act {money(t['act_buy'])}) cut={money(t['cut_value'])}")

    # ---- detail for the owner's default and the recommended config ---------------------
    for tag, P in (("decided", Params(2.0, 3.0, **dec)),
                   ("decided_measured", Params(2.0, 3.0, pre_share=measured, **dec))):
        res, daily, events = simulate(data, prof, P, keep_daily="events")
        osr = one_step(data, prof, P)
        print(f"\n== DETAIL [{tag}] {P.label()}")
        for c in ("A", "B", None):
            t = totals(data, prof, res, act, c)
            print(f"class {c or 'A+B'}: products={t['n']} stockout days sim={t['sim_so']} actual={t['act_so']} | "
                  f"lost sales value={money(t['lost_value'])} | avg morning stock sim={money(t['sim_stock'])} "
                  f"actual={money(t['act_stock'])} | avg stock after restock sim={money(t['sim_peak'])} "
                  f"actual={money(t['act_peak'])} | purchases sim={money(t['sim_buy'])} actual={money(t['act_buy'])} | "
                  f"end stock sim={money(t['sim_end'])} actual={money(t['act_end'])} | budget cuts={money(t['cut_value'])} | "
                  f"days sold more than morning stock sim={t['sim_strict']} actual={t['act_strict']}")
        print(f"{'id':>4} {'product':26} {'cls':3} {'/day':>6} | {'so_sim':>6} {'so_act':>6} {'lost':>5} | "
              f"{'stk_sim':>7} {'stk_act':>7} (days of sales) | {'buy_sim':>7} {'buy_act':>7} crates | "
              f"{'ord_d':>5} {'act_d':>5} | 1-step: {'days':>4} {'sug':>6} {'act':>6} {'short':>5} {'more':>4} {'less':>4} {'same':>4} {'incons':>6}")
        rows = []
        for u in [r["uid"] for r in listed if r["cls"] in ("A", "B")]:
            r, a, o, p = res[u], act[u], osr[u], prof[u]
            sim_stock = r["stock_sum"] / max(r["stock_days"], 1)
            row = dict(id=p["id"], name=p["name"], cls=p["cls"], per_day=p["per_day"], ppp=p["ppp"],
                       so_sim=r["so_days"], so_act=a["so_days"], lost=r["lost"],
                       stock_sim=sim_stock, stock_act=a["stock_avg"],
                       stock_sim_days=sim_stock / p["per_day"] if p["per_day"] else 0,
                       stock_act_days=a["stock_avg"] / p["per_day"] if p["per_day"] else 0,
                       stock_sim_value=sim_stock * p["cost"], stock_act_value=a["stock_avg"] * p["cost"],
                       buy_sim_crates=r["order_units"] / p["ppp"], buy_act_crates=a["buy_units"] / p["ppp"],
                       buy_sim_value=r["order_cost"], buy_act_value=a["buy_cost_basis"],
                       order_days=r["order_days"], act_buy_days=a["buy_days"],
                       cut_days=r["cut_days"], cut_value=r["cut_value"],
                       os_days=o["days"], os_sug_crates=o["sug_units"] / p["ppp"], os_act_crates=o["act_units"] / p["ppp"],
                       os_short=o["short"], os_more=o["more"], os_less=o["less"], os_same=o["same"],
                       os_inconsistent=o["act_short"])
            rows.append(row)
            if u in top20:
                print(f"{row['id']:>4} {row['name'][:26]:26} {row['cls']:3} {row['per_day']:>6.1f} | {row['so_sim']:>6} "
                      f"{row['so_act']:>6} {row['lost']:>5.0f} | {row['stock_sim']:>7.0f} {row['stock_act']:>7.0f} "
                      f"({row['stock_sim_days']:.1f} / {row['stock_act_days']:.1f}) | {row['buy_sim_crates']:>7.1f} "
                      f"{row['buy_act_crates']:>7.1f}        | {row['order_days']:>5} {row['act_buy_days']:>5} | "
                      f"        {row['os_days']:>4} {row['os_sug_crates']:>6.1f} {row['os_act_crates']:>6.1f} "
                      f"{row['os_short']:>5} {row['os_more']:>4} {row['os_less']:>4} {row['os_same']:>4} {row['os_inconsistent']:>6}")
        write_csv(f"products_{tag}.csv", rows, list(rows[0].keys()))
        write_csv(f"daily_{tag}.csv", daily, list(daily[0].keys()))
        print("stockout events (demand = units really sold that day):")
        for e in sorted(events, key=lambda e: -(e["demand"] - e["stock"] - e["order"]) * data.products[e["uid"]]["cost"])[:25]:
            print(f"   {e['date']} {e['date'].strftime('%a')} {prof[e['uid']]['name'][:24]:24} sold={e['demand']:>5.0f} "
                  f"had={e['stock']:>5.0f} ordered={e['order']:>4.0f} velocity={e['v']:>5.1f} target={e['target']:>5.0f} "
                  f"x{e['demand'] / e['v'] if e['v'] else 0:>4.1f} of velocity{' [budget cut]' if e['cut'] else ''}")
        nb = [d for d in daily if d["budget"] is not None]
        cut_days = [d for d in daily if d["cut"] > 0]
        print(f"budget: recon found for {len(nb)}/{len(daily)} days | avg budget {money(sum(d['budget'] for d in nb) / len(nb))} | "
              f"avg wanted {money(sum(d['wanted'] for d in daily) / len(daily))} | avg actual purchases (A+B) "
              f"{money(sum(d['actual'] for d in daily) / len(daily))} (all products {money(sum(d['actual_all'] for d in daily) / len(daily))}) | "
              f"days cut {len(cut_days)} total cut {money(sum(d['cut'] for d in cut_days))}")
        for d in cut_days:
            print(f"   cut {d['date']} budget={money(d['budget'])} limit={money(d['limit'])} wanted={money(d['wanted'])} "
                  f"cut={money(d['cut'])} items={d['cut_items']}")

    # ---- night-before calculation ---------------------------------------------------------
    P = Params(2.0, 3.0, **dec)
    nt = night_test(data, prof, P)
    print("\n== NIGHT-BEFORE vs MORNING-COUNT suggestion (one-step, real counts)")
    print(f"{'id':>4} {'product':26} {'days':>4} {'same':>4} {'more':>4} {'less':>4} {'|dpacks|':>8} {'|dstock|':>8} "
          f"{'short_n':>7} {'short_m':>7} {'cost_n':>11} {'cost_m':>11}")
    agg = defaultdict(float)
    for u in [r["uid"] for r in listed if r["cls"] in ("A", "B")]:
        a = nt[u]
        if not a["days"]:
            continue
        print(f"{prof[u]['id']:>4} {prof[u]['name'][:26]:26} {a['days']:>4} {a['same']:>4} {a['night_more']:>4} "
              f"{a['night_less']:>4} {a['abs_packs'] / a['days']:>8.2f} {a['abs_stock'] / a['days']:>8.1f} "
              f"{a['short_night']:>7} {a['short_morn']:>7} {money(a['night_cost']):>11} {money(a['morn_cost']):>11}")
        if prof[u]["cls"] == "A":
            for k, v in a.items():
                agg[k] += v
    print(f"class A total: product-days {agg['days']:.0f} | same {agg['same']:.0f} ({agg['same'] / agg['days']:.0%}) | "
          f"night more {agg['night_more']:.0f} | night less {agg['night_less']:.0f} | avg |packs| {agg['abs_packs'] / agg['days']:.2f} | "
          f"shortfall days night {agg['short_night']:.0f} vs morning {agg['short_morn']:.0f} | "
          f"cost night {money(agg['night_cost'])} vs morning {money(agg['morn_cost'])}")

    # ---- stock that does not move --------------------------------------------------------
    sm, as_of = slow_movers(data, prof)
    print(f"\n== SLOW / NON-MOVING STOCK (count of {as_of}, class C and unlisted)")
    for key, title in (("-", "no sale or purchase in 60 days"), ("C", "class C")):
        rs = [r for r in sm if r["cls"] == key]
        print(f"{title}: {len(rs)} products with stock, value {money(sum(r['value'] for r in rs))}")
    for act_ in sorted({r["action"] for r in sm}):
        rs = [r for r in sm if r["action"] == act_]
        print(f"  action '{act_}': {len(rs)} products, value {money(sum(r['value'] for r in rs))}")
    for r in sm[:25]:
        cov = "-" if r["cover_days"] is None else f"{r['cover_days']:.0f}"
        print(f"{r['id']:>4} {r['name'][:28]:28} {r['cls']:1} qty={r['qty']:>4.0f} value={money(r['value']):>9} "
              f"last_sale={r['last_sale']} ({r['days_since']}d) sold30={r['sold30']:.0f} sold60={r['sold60']:.0f} cover={cov}d -> {r['action']}")
    write_csv("slow_movers.csv", sm, list(sm[0].keys()))

    # ---- budget example + recon timing -----------------------------------------------
    print("\n== BUDGET EXAMPLE")
    for D in (D1 - timedelta(days=4), D1 - timedelta(days=3)):
        b = data.budget(D)
        print(f"order day {D} uses recon of {D - ONE} [{b['status']}]: received {money(b['received'])} + collections "
              f"{money(b['collections'])} - expenses {money(b['expenses'])} - accrual {money(b['accrual'])} = {money(b['budget'])}")
    late = ontime = sub_ok = missing = 0
    for D in DAYS:
        r = data.recon.get(D - ONE)
        if not r:
            missing += 1
            continue
        cutoff = f"{D.isoformat()} 15:00:00"
        if r["approved_at"] and r["approved_at"][:19] <= cutoff:
            ontime += 1
        else:
            late += 1
        if r["submitted_at"] and r["submitted_at"][:19] <= cutoff:
            sub_ok += 1
    print(f"recon of D-1 approved by 15:00 on D: {ontime}/{len(DAYS)} days; submitted by then: {sub_ok}; "
          f"not approved in time: {late}; no recon: {missing}")
    print(f"count approved by 15:00 same day: "
          f"{sum(1 for s in data.sessions if s['status'] == 'APPROVED' and D0 <= d_(s['dt']) <= D1 and s['approved_at'][:19] <= s['dt'] + ' 15:00:00')}"
          f" of {sum(1 for s in data.sessions if s['status'] == 'APPROVED' and D0 <= d_(s['dt']) <= D1)} approved sessions")

    # when would the suggestion have been available if it waits for BOTH approvals?
    appr = {d_(x["dt"]): x["approved_at"] for x in data.sessions if x["status"] == "APPROVED" and x["approved_at"]}
    hours, never = [], 0
    for D in DAYS:
        r = data.recon.get(D - ONE)
        if D not in appr or not r or not r["approved_at"]:
            never += 1
            continue
        gate =max(datetime.fromisoformat(appr[D][:19]), datetime.fromisoformat(r["approved_at"][:19]))
        hours.append((gate - datetime(D.year, D.month, D.day)).total_seconds() / 3600)
    hours.sort()
    print(f"gate (count D approved AND recon D-1 approved): never {never}/{len(DAYS)} days; of the rest median "
          f"{hours[len(hours) // 2]:.0f}h after 00:00 of D; by 12:00 {sum(h <= 12 for h in hours)}, by 15:00 "
          f"{sum(h <= 15 for h in hours)}, same day {sum(h <= 24 for h in hours)}, within 2 days {sum(h <= 48 for h in hours)}")
    ch = sorted((datetime.fromisoformat(appr[D][:19]) - datetime(D.year, D.month, D.day)).total_seconds() / 3600
                for D in DAYS if D in appr)
    print(f"count approval hour: median {ch[len(ch) // 2]:.1f}h, by 12:00 {sum(h <= 12 for h in ch)}, by 15:00 "
          f"{sum(h <= 15 for h in ch)}, same day {sum(h <= 24 for h in ch)} of {len(ch)}")

    print("\n== SUPPLIERS (purchases in window)")
    for s in data.suppliers:
        print(f"{s['supplier'][:24]:24} linked={s['linked']} purchases={s['purchases']:>4} products={s['products']:>3} value={money(f_(s['value']))}")


if __name__ == "__main__":
    main()
