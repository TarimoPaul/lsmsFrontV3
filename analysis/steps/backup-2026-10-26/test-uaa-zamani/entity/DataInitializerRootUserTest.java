package com.Lsms.uaa.entity;

import com.Lsms.Role.Repository.PermissionRepository;
import com.Lsms.Role.Repository.RoleRepository;
import com.Lsms.uaa.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 2.2.72 (21/10): boot never modifies an existing account. Until 2.2.71 DataInitializer re-activated
 * the root.email account (and set isRoot) on every boot, so admin@admin.com - deactivated by the owner -
 * came back ACTIVE after the backend restart of §1.8 (c).
 */
class DataInitializerRootUserTest {

    private UserRepository users;
    private DataInitializer init;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        when(encoder.encode(any())).thenReturn("hash");
        init = new DataInitializer(users, mock(RoleRepository.class), mock(PermissionRepository.class), encoder);
        ReflectionTestUtils.setField(init, "rootEmail", "admin@admin.com");
        ReflectionTestUtils.setField(init, "rootPassword", "Root@123");
    }

    private static User user(boolean root, User.Status status) {
        User u = new User();
        u.setEmail("admin@admin.com");
        u.setIsRoot(root);
        u.setStatus(status);
        u.setEmailVerified(true);
        return u;
    }

    private void boot() {
        ReflectionTestUtils.invokeMethod(init, "initializeRootUser");
    }

    @Test
    @DisplayName("a deactivated root.email account stays INACTIVE after boot")
    void deactivatedRootStaysInactive() {
        User u = user(true, User.Status.INACTIVE);
        when(users.findByEmail("admin@admin.com")).thenReturn(Optional.of(u));
        boot();
        assertThat(u.getStatus()).isEqualTo(User.Status.INACTIVE);
        verify(users, never()).save(any());
    }

    @Test
    @DisplayName("an existing non-root account at root.email is never promoted to root")
    void existingAccountNotPromoted() {
        User u = user(false, User.Status.ACTIVE);
        when(users.findByEmail("admin@admin.com")).thenReturn(Optional.of(u));
        boot();
        assertThat(u.getIsRoot()).isFalse();
        verify(users, never()).save(any());
    }

    @Test
    @DisplayName("an unverified root account is not changed either")
    void unverifiedRootNotChanged() {
        User u = user(true, User.Status.ACTIVE);
        u.setEmailVerified(false);
        when(users.findByEmail("admin@admin.com")).thenReturn(Optional.of(u));
        boot();
        assertThat(u.getEmailVerified()).isFalse();
        verify(users, never()).save(any());
    }

    @Test
    @DisplayName("no ROOT user is created when root.email has no account but a root user exists")
    void noCreateWhenRootExists() {
        when(users.findByEmail("admin@admin.com")).thenReturn(Optional.empty());
        when(users.countByIsRootTrue()).thenReturn(1L);
        boot();
        verify(users, never()).save(any());
    }

    @Test
    @DisplayName("ROOT_EMAIL=admin@admin.com, that account deleted, root@system.com is root: nothing is created")
    void deletedAdminNotRecreatedWhileSystemRootExists() {
        User system = user(true, User.Status.ACTIVE);
        system.setEmail("root@system.com");
        when(users.findByEmail("admin@admin.com")).thenReturn(Optional.empty());
        when(users.findByEmail("root@system.com")).thenReturn(Optional.of(system));
        when(users.countByIsRootTrue()).thenReturn(1L);
        boot();
        verify(users, never()).save(any());
        verify(users, never()).saveAndFlush(any());
        verify(users, never()).saveAll(any());
        assertThat(system.getStatus()).isEqualTo(User.Status.ACTIVE);
    }

    @Test
    @DisplayName("first install (no root user at all): the ROOT user is created ACTIVE")
    void firstInstallCreatesRoot() {
        when(users.findByEmail("admin@admin.com")).thenReturn(Optional.empty());
        when(users.countByIsRootTrue()).thenReturn(0L);
        when(users.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        boot();
        verify(users).save(argThat(u -> u.getIsRoot() && u.getStatus() == User.Status.ACTIVE && "admin@admin.com".equals(u.getEmail())));
    }
}
