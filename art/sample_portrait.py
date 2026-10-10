"""Sample the supplied GLB surface and its base-color texture for the profile field.

Run: python art/sample_portrait.py
Output: little-endian float32 [x,y,z,nx,ny,nz,r,g,b], 30,000 records.
The model is centered and normalized to a height of 0.70; RGB is in sRGB 0..255.
Requires numpy and Pillow. The supplied GLB remains the editable source asset.
"""
from pathlib import Path
from io import BytesIO
import json
import struct
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
COUNT = 30000


def main():
    raw = (ROOT / 'public/assets/self-portrait.glb').read_bytes()
    length, = struct.unpack_from('<I', raw, 12)
    meta = json.loads(raw[20:20 + length])
    binary = raw[28 + length:]

    def accessor(index):
        a = meta['accessors'][index]
        view = meta['bufferViews'][a['bufferView']]
        dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']]
        columns = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = view.get('byteStride', np.dtype(dtype).itemsize * columns)
        return np.ndarray((a['count'], columns), dtype=dtype, buffer=binary,
                          offset=offset, strides=(stride, np.dtype(dtype).itemsize)).copy()

    primitive = meta['meshes'][0]['primitives'][0]
    # This source has a single triangle mesh and an identity node transform.
    assert primitive.get('mode', 4) == 4
    assert meta['nodes'][0]['matrix'] == [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    vertices = accessor(primitive['attributes']['POSITION'])
    normals = accessor(primitive['attributes']['NORMAL'])
    uv = accessor(primitive['attributes']['TEXCOORD_0'])
    triangles = accessor(primitive['indices']).reshape(-1, 3)
    corners = vertices[triangles]
    areas = np.linalg.norm(np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0]), axis=1)
    low, high = vertices.min(axis=0), vertices.max(axis=0)
    # Preserve the likeness: spend more samples on the front of the head and glasses.
    triangle_center = corners.mean(axis=1)
    head = triangle_center[:, 1] > low[1] + (high[1] - low[1]) * .62
    front = normals[triangles].mean(axis=1)[:, 2] > .2
    areas *= np.where(head & front, 4., np.where(head, 1.8, 1.))
    rng = np.random.default_rng(1010032246)
    selected = rng.choice(len(triangles), COUNT, p=areas / areas.sum())
    ids = triangles[selected]
    root = np.sqrt(rng.random(COUNT))
    other = rng.random(COUNT)
    weights = np.stack([1 - root, root * (1 - other), root * other], axis=1)
    points = (vertices[ids] * weights[:, :, None]).sum(axis=1)
    directions = (normals[ids] * weights[:, :, None]).sum(axis=1)
    directions /= np.maximum(np.linalg.norm(directions, axis=1, keepdims=True), 1e-8)
    coords = (uv[ids] * weights[:, :, None]).sum(axis=1)
    points = (points - (low + high) / 2) * (.70 / (high[1] - low[1]))

    material = meta['materials'][primitive['material']]['pbrMetallicRoughness']
    texture = meta['textures'][material['baseColorTexture']['index']]
    image = meta['images'][texture['source']]
    view = meta['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    pixels = np.asarray(Image.open(BytesIO(binary[start:start + view['byteLength']])).convert('RGB'))
    height, width = pixels.shape[:2]
    x = np.clip((coords[:, 0] * width).astype(int), 0, width - 1)
    y = np.clip((coords[:, 1] * height).astype(int), 0, height - 1)
    colors = pixels[y, x].astype(float) * np.array(material.get('baseColorFactor', [1, 1, 1, 1])[:3])
    records = np.concatenate([points, directions, colors], axis=1).astype('<f4')
    assert records.shape == (COUNT, 9) and np.isfinite(records).all()
    target = ROOT / 'public/assets/portrait-particles.bin'
    target.write_bytes(records.tobytes())
    print(f'{COUNT:,} colored surface particles; {target.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
