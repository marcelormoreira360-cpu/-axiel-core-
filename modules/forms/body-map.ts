export type BodySide = "front" | "back";

export type BodyRegion = {
  id: string;
  label: string;
  side: BodySide;
  x: number;
  y: number;
};

export type BodyMapMark = {
  body_region: string;
  side: BodySide;
  note?: string;
  intensity?: number;
};

export const BODY_REGIONS: BodyRegion[] = [
  { id: "head_front", label: "Head", side: "front", x: 50, y: 12 },
  { id: "chest", label: "Chest", side: "front", x: 50, y: 31 },
  { id: "abdomen", label: "Abdomen", side: "front", x: 50, y: 43 },
  { id: "left_shoulder_front", label: "Left shoulder", side: "front", x: 36, y: 28 },
  { id: "right_shoulder_front", label: "Right shoulder", side: "front", x: 64, y: 28 },
  { id: "left_knee_front", label: "Left knee", side: "front", x: 43, y: 73 },
  { id: "right_knee_front", label: "Right knee", side: "front", x: 57, y: 73 },
  { id: "head_back", label: "Head", side: "back", x: 50, y: 12 },
  { id: "upper_back", label: "Upper back", side: "back", x: 50, y: 31 },
  { id: "lower_back", label: "Lower back", side: "back", x: 50, y: 48 },
  { id: "left_hip_back", label: "Left hip", side: "back", x: 42, y: 55 },
  { id: "right_hip_back", label: "Right hip", side: "back", x: 58, y: 55 },
  { id: "left_ankle_back", label: "Left ankle", side: "back", x: 43, y: 89 },
  { id: "right_ankle_back", label: "Right ankle", side: "back", x: 57, y: 89 },
];
