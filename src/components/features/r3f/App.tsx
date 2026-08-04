/**
 * Fixed full-viewport shader backdrop.
 */
import { Canvas } from "@react-three/fiber";
import Background from "./background.scene.tsx";

export default function App() {
  return (
    <Canvas
      orthographic
      camera={{ zoom: 1, position: [0, 0, 1] }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
    >
      <Background />
    </Canvas>
  );
}
