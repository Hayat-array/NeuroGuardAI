/**
 * BrainVisualization.jsx
 * Three.js particle brain sphere — exact port of the Three.js code from script.js.
 * Animates based on seizure probability (color, size, rotation speed).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function BrainVisualization({ probability = 0 }) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    brainGroup: null,
    particleGeo: null,
    particleMat: null,
    mouseX: 0,
    mouseY: 0,
    animId: null,
  });
  const probRef = useRef(probability);

  useEffect(() => {
    probRef.current = probability;
  }, [probability]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const s = stateRef.current;

    // Scene
    s.scene = new THREE.Scene();
    const W = container.clientWidth || 400;
    const H = container.clientHeight || 400;
    s.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    s.camera.position.z = 4;

    s.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    s.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    s.renderer.setSize(W, H);
    s.renderer.domElement.style.width = "100%";
    s.renderer.domElement.style.height = "100%";
    container.appendChild(s.renderer.domElement);

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        s.camera.aspect = w / h;
        s.camera.updateProjectionMatrix();
        s.renderer.setSize(w, h);
      }
    });
    ro.observe(container);

    s.brainGroup = new THREE.Group();
    s.scene.add(s.brainGroup);

    // Circular point texture
    const ptCanvas = document.createElement("canvas");
    ptCanvas.width = 64; ptCanvas.height = 64;
    const ptCtx = ptCanvas.getContext("2d");
    const grad = ptCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.8)");
    grad.addColorStop(1.0, "rgba(255,255,255,0.0)");
    ptCtx.fillStyle = grad;
    ptCtx.fillRect(0, 0, 64, 64);
    const ptTexture = new THREE.CanvasTexture(ptCanvas);

    // Particle sphere
    const PARTICLE_COUNT = 800;
    s.particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const y = 1 - (i / (PARTICLE_COUNT - 1)) * 2;
      const rxy = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = goldenAngle * i;
      const r = 2.0 + (Math.random() - 0.5) * 0.12;
      positions[i * 3] = r * rxy * Math.cos(phi);
      positions[i * 3 + 1] = r * y;
      positions[i * 3 + 2] = r * rxy * Math.sin(phi);
      randoms[i] = Math.random();
    }
    s.particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    s.particleGeo.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

    s.particleMat = new THREE.PointsMaterial({
      size: 0.07, map: ptTexture,
      color: new THREE.Color("#f97316"),
      transparent: true, opacity: 0.92,
      alphaTest: 0.01, depthWrite: false, sizeAttenuation: true,
    });
    s.brainGroup.add(new THREE.Points(s.particleGeo, s.particleMat));

    // Wireframe core
    const coreGeo = new THREE.IcosahedronGeometry(1.88, 2);
    s.brainGroup.add(new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xf97316, wireframe: true, transparent: true, opacity: 0.22 })));
    const outerGeo = new THREE.IcosahedronGeometry(2.05, 1);
    s.brainGroup.add(new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({ color: 0xfb923c, wireframe: true, transparent: true, opacity: 0.14 })));

    // Inner glow
    const glowGeo = new THREE.SphereGeometry(1.0, 24, 24);
    s.brainGroup.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0x1e1b4b, transparent: true, opacity: 0.22 })));

    // Connection lines
    const lineGeo = new THREE.BufferGeometry();
    const lineVerts = [];
    const pos = s.particleGeo.attributes.position;
    for (let i = 0; i < 80; i++) {
      const a = Math.floor(Math.random() * PARTICLE_COUNT);
      const b = Math.floor(Math.random() * PARTICLE_COUNT);
      lineVerts.push(pos.getX(a), pos.getY(a), pos.getZ(a));
      lineVerts.push(pos.getX(b), pos.getY(b), pos.getZ(b));
    }
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
    s.brainGroup.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.28 })));

    // Mouse
    const onMouse = (e) => {
      s.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      s.mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    document.addEventListener("mousemove", onMouse);

    // Animation loop
    function animate() {
      s.animId = requestAnimationFrame(animate);
      const prob = probRef.current;
      const t = Date.now() * 0.001;
      const posAttr = s.particleGeo.attributes.position;
      const randAttr = s.particleGeo.attributes.aRandom;
      for (let i = 0; i < posAttr.count; i++) {
        const r = randAttr.getX(i);
        const wave = Math.sin(t * (0.6 + r * 0.8) + i * 0.02) * 0.04;
        posAttr.setXYZ(i,
          posAttr.getX(i) * (1 + wave * 0.05),
          posAttr.getY(i) * (1 + wave * 0.05),
          posAttr.getZ(i) * (1 + wave * 0.05)
        );
      }
      posAttr.needsUpdate = true;

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (isDark) {
        const h = 0.07 - prob * 0.07;
        s.particleMat.color.setHSL(h, 1.0, 0.55 + prob * 0.1);
      } else {
        s.particleMat.color.setHSL(0.55 - prob * 0.55, 0.9, 0.55);
      }
      s.particleMat.size = 0.040 + prob * 0.030;
      s.particleMat.opacity = 0.85 + prob * 0.12;

      s.brainGroup.rotation.y += 0.004 + prob * 0.008;
      s.brainGroup.rotation.x += 0.0015;
      s.brainGroup.rotation.y += (s.mouseX * 0.3 - s.brainGroup.rotation.y) * 0.02;
      s.brainGroup.rotation.x += (s.mouseY * -0.15 - s.brainGroup.rotation.x) * 0.02;

      s.renderer.render(s.scene, s.camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(s.animId);
      document.removeEventListener("mousemove", onMouse);
      ro.disconnect();
      s.renderer.dispose();
      if (container.contains(s.renderer.domElement)) {
        container.removeChild(s.renderer.domElement);
      }
    };
  }, []);

  return <div id="brain-container" ref={containerRef} className="brain-canvas" />;
}
