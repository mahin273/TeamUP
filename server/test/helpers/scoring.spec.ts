import { expectedScore } from './scoring';

describe('reference scoring formula (oracle)', () => {
  it('MATCH-U1 perfect candidate scores 1', () => {
    expect(
      expectedScore({
        overlap: 4,
        required: 4,
        experienceMatch: 1,
        avgEvaluation: 1,
        availabilityMatch: 1,
      }),
    ).toBeCloseTo(1, 5);
  });
  it('MATCH-U3 half the skills gives 0.25 from the skill term', () => {
    expect(
      expectedScore({
        overlap: 2,
        required: 4,
        experienceMatch: 0,
        avgEvaluation: 0,
        availabilityMatch: 0,
      }),
    ).toBeCloseTo(0.25, 5);
  });
  it('MATCH-U4 zero required skills does not produce NaN', () => {
    const s = expectedScore({
      overlap: 0,
      required: 0,
      experienceMatch: 1,
      avgEvaluation: 1,
      availabilityMatch: 1,
    });
    expect(Number.isNaN(s)).toBe(false);
  });
  it('MATCH-U7 unavailable candidate loses exactly 0.1', () => {
    const base = {
      overlap: 2,
      required: 2,
      experienceMatch: 1,
      avgEvaluation: 1,
    };
    const diff =
      expectedScore({ ...base, availabilityMatch: 1 }) -
      expectedScore({ ...base, availabilityMatch: 0 });
    expect(diff).toBeCloseTo(0.1, 5);
  });
});
