// Program definition. Exercise keys (A1, B3...) are stable identifiers that
// history rows reference, so never renumber them.

export const PROGRAM = {
  name: "Full Body 3x/week",
  goal: "Hypertrophy + strength",
  cardio: {
    img: "Walking_Treadmill",
    name: "Incline treadmill walk",
    minutes: "15-20",
    hr: "120-140",
    rule: "2x per week, on a non-lifting day or after Day B/C. Never after Day A.",
  },
  nutrition: { protein: "130-150 g protein", creatine: "5 g creatine" },
  days: [
    {
      id: "A", focus: "Squat · Press · Row", cardioAfter: false,
      exercises: [
        { key: "A1", name: "Leg press", img: "Leg_Press", muscle: "Quads", sets: 3, reps: "8-10", rest: 120,
          alt: { name: "Smith machine squat", img: "Smith_Machine_Squat" } },
        { key: "A2", name: "Flat dumbbell press", img: "Dumbbell_Bench_Press", muscle: "Chest", sets: 3, reps: "8-10", rest: 90,
          alt: { name: "Machine chest press", img: "Machine_Bench_Press" } },
        { key: "A3", name: "Chest-supported row", img: "Lying_T-Bar_Row", muscle: "Back", sets: 3, reps: "10-12", rest: 90,
          alt: { name: "Seated cable row", img: "Seated_Cable_Rows" } },
        { key: "A4", name: "Leg curl", img: "Seated_Leg_Curl", muscle: "Hamstrings", sets: 2, reps: "10-12", rest: 60,
          alt: { name: "Lying leg curl", img: "Lying_Leg_Curls" } },
        { key: "A5", name: "Lateral raise", img: "Side_Lateral_Raise", muscle: "Side delts", sets: 3, reps: "12-15", rest: 60 },
        { key: "A6", name: "Rope triceps pushdown", img: "Triceps_Pushdown_-_Rope_Attachment", muscle: "Triceps", sets: 2, reps: "10-12", rest: 60 },
        { key: "A7", name: "Plank", img: "Plank", muscle: "Core", sets: 2, reps: "45-60 sec", rest: 45, bodyweight: true },
      ],
    },
    {
      id: "B", focus: "Hinge · Pull · Incline", cardioAfter: true,
      exercises: [
        { key: "B1", name: "Hip thrust", img: "Barbell_Hip_Thrust", muscle: "Glutes", sets: 3, reps: "8-10", rest: 120,
          alt: { name: "Dumbbell RDL", img: "Stiff-Legged_Dumbbell_Deadlift" } },
        { key: "B2", name: "Lat pulldown", img: "Wide-Grip_Lat_Pulldown", muscle: "Lats", sets: 3, reps: "8-10", rest: 90 },
        { key: "B3", name: "Incline dumbbell press", img: "Incline_Dumbbell_Press", muscle: "Upper chest", sets: 3, reps: "10-12", rest: 90,
          alt: { name: "Incline machine press", img: "Leverage_Incline_Chest_Press" } },
        { key: "B4", name: "Leg extension", img: "Leg_Extensions", muscle: "Quads", sets: 2, reps: "12-15", rest: 60 },
        { key: "B5", name: "Face pull", img: "Face_Pull", muscle: "Rear delts", sets: 3, reps: "12-15", rest: 60,
          alt: { name: "Rear delt fly", img: "Cable_Rear_Delt_Fly" } },
        { key: "B6", name: "Dumbbell curl", img: "Dumbbell_Bicep_Curl", muscle: "Biceps", sets: 2, reps: "10-12", rest: 60,
          alt: { name: "Barbell curl", img: "Barbell_Curl" } },
        { key: "B7", name: "Standing calf raise", img: "Standing_Calf_Raises", muscle: "Calves", sets: 3, reps: "12-15", rest: 60 },
      ],
    },
    {
      id: "C", focus: "Legs · Delts · Arms", cardioAfter: true,
      exercises: [
        { key: "C1", name: "Leg press", img: "Leg_Press", muscle: "Quads", sets: 3, reps: "10-12", rest: 120,
          alt: { name: "Bulgarian split squat", img: "Split_Squat_with_Dumbbells", reps: "10-12/side" } },
        { key: "C2", name: "Seated dumbbell press", img: "Seated_Dumbbell_Press", muscle: "Shoulders", sets: 3, reps: "8-10", rest: 90,
          alt: { name: "Machine shoulder press", img: "Machine_Shoulder_Military_Press" } },
        { key: "C3", name: "Wide-grip cable row", img: "Seated_Cable_Rows", muscle: "Back", sets: 3, reps: "10-12", rest: 90 },
        { key: "C4", name: "Pec deck", img: "Butterfly", muscle: "Chest", sets: 3, reps: "12-15", rest: 60,
          alt: { name: "Cable fly", img: "Cable_Crossover" } },
        { key: "C5", name: "Hammer curl", img: "Hammer_Curls", muscle: "Biceps", sets: 2, reps: "10-12", rest: 60 },
        { key: "C6", name: "Overhead triceps extension", img: "Cable_Rope_Overhead_Triceps_Extension", muscle: "Triceps", sets: 2, reps: "10-12", rest: 60 },
        { key: "C7", name: "Seated calf raise", img: "Seated_Calf_Raise", muscle: "Calves", sets: 3, reps: "12-15", rest: 60 },
        { key: "C8", name: "Pallof press", img: "Pallof_Press", muscle: "Core", sets: 2, reps: "10-12/side", rest: 45,
          alt: { name: "Side plank", img: "Side_Bridge", reps: "30-45 sec", bodyweight: true } },
      ],
    },
  ],
  principles: [
    "Leave 1-3 reps in reserve on most sets. Push near failure only on the last set of each exercise.",
    "Double progression: hit the top of the rep range on every set two sessions running, then add weight and drop back to the bottom of the range.",
    "Take one lighter week (about half volume) every 4-6 weeks.",
    "Schedule the three training days flexibly around work, not fixed calendar days.",
  ],
};

export const DAY_IDS = PROGRAM.days.map(d => d.id);

export function dayOf(id) {
  return PROGRAM.days.find(d => d.id === id) || PROGRAM.days[0];
}

export function exerciseByKey(key) {
  for (const d of PROGRAM.days) for (const e of d.exercises) if (e.key === key) return e;
  return null;
}

// Resolve the variant of an exercise the user has chosen (primary or alt).
export function resolveExercise(ex, prefs) {
  const useAlt = !!(prefs && prefs[ex.key] === "alt" && ex.alt);
  if (!useAlt) return { ...ex, variant: "main" };
  return {
    ...ex,
    name: ex.alt.name,
    img: ex.alt.img,
    reps: ex.alt.reps || ex.reps,
    bodyweight: ex.alt.bodyweight ?? ex.bodyweight,
    variant: "alt",
  };
}

const num = s => { const m = String(s).match(/\d+/g); return m ? m.map(Number) : [0]; };
export const repLow = s => num(s)[0];
export const repTop = s => { const n = num(s); return n[n.length > 1 ? 1 : 0]; };
export const isTimed = s => /sec/i.test(s);

// Default weekly template. Cardio is never placed on an A day.
export const DEFAULT_SCHEDULE = ["A", "cardio", "B", "rest", "C", "cardio", "rest"]; // Mon..Sun

export const SLOT_LABEL = { A: "Day A", B: "Day B", C: "Day C", cardio: "Cardio", rest: "Rest" };
export const SLOT_CYCLE = ["A", "B", "C", "cardio", "rest"];
