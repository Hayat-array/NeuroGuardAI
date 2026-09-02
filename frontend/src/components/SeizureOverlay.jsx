/**
 * SeizureOverlay.jsx
 * Red pulsing border that flashes when seizure probability >= 0.75
 */
export default function SeizureOverlay({ visible }) {
  return (
    <div
      id="seizure-overlay"
      className={"seizure-overlay" + (visible ? "" : " hidden")}
    />
  );
}
