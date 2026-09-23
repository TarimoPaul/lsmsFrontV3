import { FormControl, FormGroup, Validators } from '@angular/forms';

import { LsmsValidators, formErrorMessage } from './validators';

describe('LsmsValidators', () => {
  const run = (v: ReturnType<typeof LsmsValidators.required>, value: unknown) => v(new FormControl(value));

  it('required treats blank strings as empty', () => {
    expect(run(LsmsValidators.required('Name'), '  ')).toEqual({ required: { field: 'Name' } });
    expect(run(LsmsValidators.required('Name'), 'Juma')).toBeNull();
  });

  it('phone accepts Tanzanian formats only', () => {
    const v = LsmsValidators.phone();
    expect(run(v, '0712345678')).toBeNull();
    expect(run(v, '+255 712 345 678')).toBeNull();
    expect(run(v, '255712345678')).toBeNull();
    expect(run(v, '12345')).toEqual({ phone: {} });
    expect(run(v, '')).toBeNull(); // optional unless combined with required
  });

  it('currency parses formatted amounts and checks bounds', () => {
    const v = LsmsValidators.currency('Price', 1);
    expect(run(v, '1,500')).toBeNull();
    expect(run(v, 0)).toEqual({ minValue: { field: 'Price', min: 1 } });
    expect(run(v, 'abc')).toEqual({ currency: { field: 'Price' } });
  });

  it('match compares against a sibling control', () => {
    const group = new FormGroup({
      password: new FormControl('secret1'),
      confirm: new FormControl('secret2', LsmsValidators.match('password', 'Confirm', 'Password')),
    });
    group.controls.confirm.updateValueAndValidity();
    expect(group.controls.confirm.errors).toEqual({ match: { field: 'Confirm', match: 'Password' } });
  });
});

describe('formErrorMessage', () => {
  it('renders bilingual messages', () => {
    expect(formErrorMessage({ required: { field: 'Jina' } }, 'sw')).toBe('Jina ni lazima');
    expect(formErrorMessage({ required: { field: 'Name' } }, 'en')).toBe('Name is required');
    expect(formErrorMessage({ minLength: { field: 'Password', length: 6 } }, 'en')).toBe(
      'Password must be at least 6 characters',
    );
  });

  it('maps Angular built-in errors', () => {
    const c = new FormControl('ab', Validators.minLength(4));
    expect(formErrorMessage(c.errors, 'en', 'Code')).toBe('Code must be at least 4 characters');
  });

  it('returns null when there are no errors', () => {
    expect(formErrorMessage(null, 'en')).toBeNull();
  });
});
