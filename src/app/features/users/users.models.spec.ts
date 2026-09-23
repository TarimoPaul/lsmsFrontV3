import { fullName, roleColor, STATUS_META, USER_STATUSES, userInitials } from './users.models';

describe('users.models', () => {
  it('builds full name and falls back to email', () => {
    expect(fullName({ firstName: 'Paul', lastName: 'Tarimo' })).toBe('Paul Tarimo');
    expect(fullName({ firstName: null, lastName: null, email: 'a@b.co' })).toBe('a@b.co');
  });

  it('derives initials', () => {
    expect(userInitials({ firstName: 'jess', lastName: 'saimon' })).toBe('JS');
    expect(userInitials({ email: 'root@system.com' })).toBe('R');
    expect(userInitials({})).toBe('?');
  });

  it('colours roles like Flutter', () => {
    expect(roleColor('ROOT')).toBe('var(--c-error)');
    expect(roleColor('CEO')).toBe('#9c27b0');
    expect(roleColor('Store keeper')).toBe('#ff9800');
    expect(roleColor('printer')).toBe('var(--c-primary)');
  });

  it('has status metadata for every filterable status', () => {
    for (const s of [...USER_STATUSES, 'TERMINATED' as const]) expect(STATUS_META[s]).toBeTruthy();
  });
});
