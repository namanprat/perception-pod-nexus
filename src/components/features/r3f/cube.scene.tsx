/**
 * Ported verbatim from pmndrs/react-three-start, examples/minimal (MIT).
 * https://github.com/pmndrs/react-three-start
 *
 * `*.scene.tsx` files render inside the Canvas — that is the framework's
 * convention, kept here so the files stay recognisable against upstream.
 */
export default function Cube() {
  return (
    <mesh rotation={[0.4, 0.6, 0]}>
      <boxGeometry />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}
