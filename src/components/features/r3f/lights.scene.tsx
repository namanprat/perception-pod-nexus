/**
 * Ported verbatim from pmndrs/react-three-start, examples/minimal (MIT).
 * https://github.com/pmndrs/react-three-start
 */
export default function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 3]} intensity={2} />
    </>
  );
}
