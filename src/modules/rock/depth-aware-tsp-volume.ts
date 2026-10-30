import * as Cesium from 'cesium'

interface TspAtlasDefinition {
  objects: Array<{ volume: { url: string; res: [number, number, number] } }>
}

export interface DepthAwareTspVolume {
  readonly stage: Cesium.PostProcessStage
  setAppearance(opacity: number, contrast: number): void
  destroy(): void
}

// The source atlas stores z slices in a 21 x 5 grid, each 101 x 401 pixels.
// A post-process stage runs after opaque GLBs and can stop each ray at the
// scene depth. VoxelPrimitive runs before Pass.OPAQUE in Cesium 1.140.
const fragmentShader = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform sampler2D u_atlas;
uniform mat4 u_eyeToUnit;
uniform vec3 u_resolution;
uniform vec2 u_tiles;
uniform float u_opacity;
uniform float u_contrast;
uniform float u_hardness;
uniform float u_debug;
in vec2 v_textureCoordinates;

float readSlice(vec3 p, float zIndex) {
  float column = mod(zIndex, u_tiles.x);
  float row = floor(zIndex / u_tiles.x);
  vec2 texel = (vec2(column, row) * u_resolution.xy + vec2(0.5) +
    clamp(p.xy, 0.0, 1.0) * (u_resolution.xy - 1.0)) /
    (u_resolution.xy * u_tiles);
  return texture(u_atlas, texel).r;
}

float readAtlas(vec3 p) {
  float z = clamp(p.z, 0.0, 1.0) * (u_resolution.z - 1.0);
  float a = floor(z);
  float b = min(a + 1.0, u_resolution.z - 1.0);
  return mix(readSlice(p, a), readSlice(p, b), fract(z));
}

void main() {
  vec2 uv = v_textureCoordinates;
  vec4 sceneColor = texture(colorTexture, uv);
  vec2 xy = uv * 2.0 - 1.0;
  vec4 nearEye = czm_inverseProjection * vec4(xy, 0.0, 1.0);
  vec3 rayEye = normalize(nearEye.xyz / nearEye.w);
  vec3 origin = (u_eyeToUnit * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 direction = (u_eyeToUnit * vec4(rayEye, 0.0)).xyz;
  vec3 t0 = (vec3(0.0) - origin) / direction;
  vec3 t1 = (vec3(1.0) - origin) / direction;
  vec3 nearT = min(t0, t1);
  vec3 farT = max(t0, t1);
  float enter = max(max(nearT.x, nearT.y), max(nearT.z, 0.0));
  float leave = min(min(farT.x, farT.y), farT.z);
  if (leave <= enter) { out_FragColor = sceneColor; return; }

  float sceneDepth = texture(depthTexture, uv).r;
  float surfaceDistance = 10000.0;
  if (sceneDepth < 0.999999) {
    vec4 surfaceEye = czm_windowToEyeCoordinates(gl_FragCoord.xy, sceneDepth);
    surfaceDistance = length(surfaceEye.xyz / surfaceEye.w);
    leave = min(leave, surfaceDistance);
  }
  if (u_debug > 1.5) {
    out_FragColor = vec4(clamp(surfaceDistance / 100.0, 0.0, 1.0), sceneDepth, 0.0, 1.0);
    return;
  }
  if (leave <= enter) { out_FragColor = sceneColor; return; }

  vec3 accumulated = vec3(0.0);
  float alpha = 0.0;
  float stepLength = max((leave - enter) / 96.0, 0.35);
  for (int i = 0; i < 96; i++) {
    float t = enter + (float(i) + 0.5) * stepLength;
    if (t >= leave || alpha > 0.97) break;
    vec3 p = origin + direction * t;
    float value = readAtlas(p);
    // 255 is the atlas no-data background, not the highest rock class.
    if (value > 0.94 && u_debug < 0.5) continue;
    float classValue = clamp(value * u_contrast, 0.0, 1.0);
    vec3 colour = u_hardness > 0.5
      ? mix(vec3(0.13, 0.53, 0.95), vec3(0.03, 0.82, 0.84), classValue)
      : mix(vec3(0.94, 0.30, 0.19), vec3(0.12, 0.67, 0.91), classValue);
    float a = u_opacity * (u_hardness > 0.5 ? 0.21 : 0.055);
    accumulated += (1.0 - alpha) * a * colour;
    alpha += (1.0 - alpha) * a;
  }
  out_FragColor = vec4(sceneColor.rgb * (1.0 - alpha) + accumulated, sceneColor.a);
}`

function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  return image.decode().then(() => image)
}

export async function createDepthAwareTspVolume(
  viewer: Cesium.Viewer,
  jsonUrl: string,
  worldMatrix: Cesium.Matrix4,
  kind: 'hardness' | 'integrity',
  signal?: AbortSignal,
  debug = 0,
): Promise<DepthAwareTspVolume> {
  const response = await fetch(jsonUrl, { signal })
  if (!response.ok) throw new Error(`TSP 图集配置不可用：${jsonUrl} (${response.status})`)
  const definition = await response.json() as TspAtlasDefinition
  const volume = definition.objects?.[0]?.volume
  if (!volume?.url || volume.res.length !== 3) throw new Error(`TSP 图集配置不完整：${jsonUrl}`)
  const image = await loadImage(new URL(volume.url, response.url).href)
  if (signal?.aborted) throw signal.reason ?? new DOMException('TSP 加载已取消', 'AbortError')
  const [x, y, z] = volume.res
  const columns = image.width / x
  const rows = image.height / y
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns * rows < z) {
    throw new Error(`TSP 图集尺寸与体素分辨率不符：${image.width}×${image.height}`)
  }

  const worldToUnit = Cesium.Matrix4.inverse(worldMatrix, new Cesium.Matrix4())
  const eyeToUnit = new Cesium.Matrix4()
  let opacity = 0.68
  let contrast = 1.2
  const stage = new Cesium.PostProcessStage({
    name: `tsp-depth-${kind}-${Date.now()}`,
    fragmentShader,
    uniforms: {
      u_atlas: image,
      u_eyeToUnit: () => Cesium.Matrix4.multiply(worldToUnit, viewer.camera.inverseViewMatrix, eyeToUnit),
      u_resolution: new Cesium.Cartesian3(x, y, z),
      u_tiles: new Cesium.Cartesian2(columns, rows),
      u_opacity: () => opacity,
      u_contrast: () => contrast,
      u_hardness: kind === 'hardness' ? 1 : 0,
      u_debug: debug,
    },
  })
  viewer.scene.postProcessStages.add(stage)
  viewer.scene.requestRender()
  return {
    stage,
    setAppearance(nextOpacity, nextContrast) {
      opacity = Cesium.Math.clamp(nextOpacity, 0.08, 1)
      contrast = Cesium.Math.clamp(nextContrast, 0.6, 2.4)
      viewer.scene.requestRender()
    },
    destroy() {
      if (!viewer.isDestroyed() && !stage.isDestroyed()) viewer.scene.postProcessStages.remove(stage)
    },
  }
}
