// Extracted from JDhruv14/ascii-diorama 3d3278a0f925aebddc574dfb7042eb1eb815f427.
// MIT, copyright 2026 JDhruv14. See ../LICENSE-upstream.txt.
const SURFACE_CLASSES = { grass: 1, leaf: 2, flower: 3, stone: 4, stair: 5, torii: 6, wood: 7, sand: 8, water: 9, foam: 10, fox: 11, roof: 12, rock: 13 };
function tag(mat, cls, extra) {
  mat.onBeforeCompile = (s) => {
    extra?.(s);
    s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n gl_FragColor.a = ${(cls / 16).toFixed(4)};`);
  };
  mat.customProgramCacheKey = () => `c${cls}${extra ? extra.toString().length : 0}`;
  return mat;
}
export { tag, SURFACE_CLASSES };
