export type SnapshotImplementationStep = {
  order: number;
  name: string;
  goal: string;
  files: string[];
  result: string;
};

export const SNAPSHOT_IMPLEMENTATION_STEPS: SnapshotImplementationStep[] = [
  {
    order: 1,
    name: "Builder",
    goal: "Build a clean Snapshot object from patient journey data.",
    files: [
      "/modules/patient-journey/snapshot-builder.ts",
      "/modules/patient-journey/patient-context.ts",
      "/modules/patient-journey/next-step-rules.ts",
    ],
    result: "Snapshot can be built without changing UI.",
  },
  {
    order: 2,
    name: "Service",
    goal: "Fetch patient data and return one Snapshot object.",
    files: ["/services/patient-snapshot-service.ts", "/services/patient-journey-service.ts"],
    result: "Any page can call getPatientSnapshot(patientId).",
  },
  {
    order: 3,
    name: "UI Component",
    goal: "Display the Snapshot as a calm AXIEL card.",
    files: [
      "/components/patient-snapshot.tsx",
      "/components/latest-insight-card.tsx",
      "/components/next-step-card.tsx",
      "/components/patient-journey-timeline.tsx",
    ],
    result: "Snapshot can be reused across Schedule, Patient Profile, Dashboard and Portal.",
  },
  {
    order: 4,
    name: "Schedule Drawer",
    goal: "Show context inside each Session drawer.",
    files: ["/app/schedule/page.tsx", "/components/session-drawer.tsx"],
    result: "Professional sees patient context without leaving the Schedule.",
  },
  {
    order: 5,
    name: "Patient Profile",
    goal: "Show Snapshot at the top of the patient profile.",
    files: ["/app/patients/[id]/page.tsx"],
    result: "Patient context appears before long history.",
  },
  {
    order: 6,
    name: "Dashboard",
    goal: "Use Snapshot to support guided actions.",
    files: ["/app/dashboard/page.tsx"],
    result: "Dashboard becomes more intelligent and action-oriented.",
  },
  {
    order: 7,
    name: "Patient Portal Lite",
    goal: "Show a simple, safe version for the patient.",
    files: ["/app/p/[token]/page.tsx", "/components/patient-portal/patient-portal-dashboard.tsx"],
    result: "Patient sees progress and Next Step in simple language.",
  },
];
