import * as THREE from 'three';
import type { GiftItem } from '../content/giftData';
import type { ExperienceState } from '../state/ExperienceState';

export interface SceneCallbacks {
  onGiftClick: (giftId: string) => void;
  onDoorClick: () => void;
  onBoxClick: () => void;
}

export class GiftBoxScene {
  private container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private callbacks: SceneCallbacks;

  // The Grand Unfolding / Explosion Box
  private mainBoxGroup: THREE.Group;
  private boxLidGroup: THREE.Group;
  private wallFront: THREE.Group;
  private wallBack: THREE.Group;
  private wallLeft: THREE.Group;
  private wallRight: THREE.Group;
  private boxFloor!: THREE.Mesh;
  private ribbonBandsGroup: THREE.Group;
  private ribbonBowGroup: THREE.Group;
  private interiorWarmLight!: THREE.PointLight;

  // Dust & Sparkle Particles
  private particles!: THREE.Points;
  private particlePositions!: Float32Array;

  // Gifts on the platform
  private giftsGroup: THREE.Group;
  private giftMeshes: Map<string, THREE.Group> = new Map();
  private giftsData: GiftItem[] = [];

  // Popup Teddy inside Gift 1
  private miniTeddyInBox!: THREE.Group;
  private miniTeddyPopped: boolean = false;

  // 3D Collection Bin
  private binGroup: THREE.Group;
  private binItemsGroup: THREE.Group;

  // Full-size Walking Teddy Character
  private teddyGroup: THREE.Group;
  private teddyLeftLeg: THREE.Group;
  private teddyRightLeg: THREE.Group;
  private teddyLeftArm: THREE.Group;
  private teddyRightArm: THREE.Group;
  private teddyHead: THREE.Group;
  private teddyWalking: boolean = false;
  private teddyDirection: number = 1; // 1 = entering, -1 = leaving

  // 3D Door
  private doorGroup: THREE.Group;
  private doorHingedPanel: THREE.Group;
  private doorHandle!: THREE.Mesh;
  private doorLight!: THREE.PointLight;

  // State & Camera targets
  private currentState: ExperienceState = 'BOOT';
  private cameraTargetPos: THREE.Vector3 = new THREE.Vector3(0, 2.2, 5.8);
  private cameraLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private orbitRadius = 6.2;
  private orbitYaw = 0;
  private orbitPitch = 0.28;
  private targetOrbitYaw = 0;
  private targetOrbitPitch = 0.28;

  // A drag is deliberately handled separately from a tap, so gifts remain easy to select.
  private activePointerId: number | null = null;
  private pointerStart = new THREE.Vector2();
  private pointerLast = new THREE.Vector2();
  private isDragging = false;

  // Animations progress
  private unwrapProgress: number = 0; // 0 = closed, 1 = untied, walls down
  private doorOpenProgress: number = 0;
  private isUnwrapping: boolean = false;
  private isDoorOpening: boolean = false;

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private animId: number | null = null;
  private clock = new THREE.Timer();

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x190b15);
    this.scene.fog = new THREE.FogExp2(0x190b15, 0.032);

    // 2. Camera setup
    const aspect = container.clientWidth / container.clientHeight;
    const initialFov = container.clientWidth < 768 ? 70 : 45;
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 100);
    this.camera.position.copy(this.cameraTargetPos);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, container.clientWidth < 768 ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);
    this.clock.connect(document);

    // 4. Lighting
    this.setupLighting();

    // 5. Build 3D Entities
    this.mainBoxGroup = new THREE.Group();
    this.boxLidGroup = new THREE.Group();
    this.wallFront = new THREE.Group();
    this.wallBack = new THREE.Group();
    this.wallLeft = new THREE.Group();
    this.wallRight = new THREE.Group();
    this.ribbonBandsGroup = new THREE.Group();
    this.ribbonBowGroup = new THREE.Group();
    this.giftsGroup = new THREE.Group();
    this.binGroup = new THREE.Group();
    this.binItemsGroup = new THREE.Group();
    this.teddyGroup = new THREE.Group();
    this.teddyLeftLeg = new THREE.Group();
    this.teddyRightLeg = new THREE.Group();
    this.teddyLeftArm = new THREE.Group();
    this.teddyRightArm = new THREE.Group();
    this.teddyHead = new THREE.Group();
    this.doorGroup = new THREE.Group();
    this.doorHingedPanel = new THREE.Group();

    this.createEnvironment();
    this.createGrandGiftBox();
    this.createBin();
    this.createTeddyCharacter();
    this.createDoor();

    this.scene.add(this.mainBoxGroup);
    this.scene.add(this.giftsGroup);
    this.scene.add(this.binGroup);
    this.scene.add(this.teddyGroup);
    this.scene.add(this.doorGroup);

    // Event listeners
    window.addEventListener('resize', this.onResize);
    this.container.addEventListener('pointerdown', this.onPointerDown);
    this.container.addEventListener('pointermove', this.onPointerMove);
    this.container.addEventListener('pointerup', this.onPointerUp);
    this.container.addEventListener('pointercancel', this.onPointerCancel);

    this.renderLoop();
  }

  private setupLighting() {
    // Ambient soft room tone
    const ambLight = new THREE.AmbientLight(0xffe9dc, 1.75);
    this.scene.add(ambLight);

    // Warm Key Spotlight casting soft shadow
    const spot = new THREE.SpotLight(0xffefd0, 4.4);
    spot.position.set(4, 8, 5.5);
    spot.angle = Math.PI / 3.8;
    spot.penumbra = 0.55;
    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.shadow.bias = -0.0005;
    this.scene.add(spot);

    // Soft pastel fill light
    const fillLight = new THREE.DirectionalLight(0xdca5c8, 1.5);
    fillLight.position.set(-5, 5, -2);
    this.scene.add(fillLight);

    // Warm golden interior point light
    this.interiorWarmLight = new THREE.PointLight(0xffbe44, 0, 7, 1.8);
    this.interiorWarmLight.position.set(0, 0.6, 0);
    this.scene.add(this.interiorWarmLight);

    const roseFill = new THREE.PointLight(0xa52e61, 1.2, 12, 2);
    roseFill.position.set(-4, 2.5, 2);
    this.scene.add(roseFill);
  }

  private createEnvironment() {
    // Stage floor with soft warm ivory finish
    const floorGeo = new THREE.PlaneGeometry(40, 40);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x180b14,
      roughness: 0.68,
      metalness: 0.16,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.15;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle circular gold-trimmed pedestal under the box
    const pedGeo = new THREE.CylinderGeometry(2.9, 3.1, 0.12, 48);
    const pedMat = new THREE.MeshStandardMaterial({
      color: 0x3d1127,
      roughness: 0.35,
      metalness: 0.48,
    });
    const ped = new THREE.Mesh(pedGeo, pedMat);
    ped.position.y = -1.1;
    ped.receiveShadow = true;
    this.scene.add(ped);

    const inlay = new THREE.Mesh(
      new THREE.CylinderGeometry(2.74, 2.85, 0.035, 64),
      new THREE.MeshStandardMaterial({ color: 0x5b1a36, roughness: 0.42, metalness: 0.34 }),
    );
    inlay.position.y = -1.015;
    this.scene.add(inlay);

    // Golden trim around pedestal
    const rimGeo = new THREE.TorusGeometry(3.05, 0.035, 12, 48);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf2cf77, emissive: 0x4f2d08, emissiveIntensity: 0.28, metalness: 0.92, roughness: 0.2 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -1.04;
    this.scene.add(rim);

    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(2.66, 0.018, 10, 64), rimMat);
    innerRim.rotation.x = Math.PI / 2;
    innerRim.position.y = -0.99;
    this.scene.add(innerRim);

    // Floating golden dust particles
    const count = 220;
    const geo = new THREE.BufferGeometry();
    this.particlePositions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      this.particlePositions[i] = (Math.random() - 0.5) * 12;
      this.particlePositions[i + 1] = Math.random() * 5.5 - 0.5;
      this.particlePositions[i + 2] = (Math.random() - 0.5) * 10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xffdf85,
      size: 0.035,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(geo, pMat);
    this.scene.add(this.particles);
  }

  // Build the grand gift box with 4 unfolding explosion-box walls and removable lid
  private createGrandGiftBox() {
    const size = 2.8;
    const height = 1.9;
    const half = size / 2;

    const velvetMat = new THREE.MeshStandardMaterial({
      color: 0x5a102e, // Deep rich burgundy velvet
      roughness: 0.48,
      metalness: 0.26,
    });

    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x260913,
      roughness: 0.58,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf2cf77,
      roughness: 0.2,
      metalness: 0.92,
    });

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xffdb7a, // Lustrous champagne gold ribbon
      roughness: 0.22,
      metalness: 0.86,
    });

    // 1. Box Floor Base
    const floorGeo = new THREE.BoxGeometry(size, 0.08, size);
    this.boxFloor = new THREE.Mesh(floorGeo, interiorMat);
    this.boxFloor.position.y = -height / 2 + 0.04;
    this.boxFloor.receiveShadow = true;
    this.mainBoxGroup.add(this.boxFloor);

    // Helper to create a hinged wall that folds outward 90 degrees
    const createWall = (pivotPos: THREE.Vector3, isZ: boolean, rotSign: number) => {
      const hingeGroup = new THREE.Group();
      hingeGroup.position.copy(pivotPos);

      // Wall panel
      const wallGeo = new THREE.BoxGeometry(size, height, 0.06);
      const wallMesh = new THREE.Mesh(wallGeo, velvetMat);
      wallMesh.position.set(0, height / 2, 0);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      hingeGroup.add(wallMesh);

      // Gold border trim on wall edge
      const trimGeo = new THREE.BoxGeometry(size + 0.02, 0.04, 0.08);
      const trim = new THREE.Mesh(trimGeo, goldMat);
      trim.position.set(0, height, 0);
      hingeGroup.add(trim);

      hingeGroup.userData = { isZ, rotSign };
      return hingeGroup;
    };

    // Front Wall (hinge at bottom front: z = half)
    this.wallFront = createWall(new THREE.Vector3(0, -height / 2, half), false, 1);
    this.mainBoxGroup.add(this.wallFront);

    // Back Wall (hinge at bottom back: z = -half)
    this.wallBack = createWall(new THREE.Vector3(0, -height / 2, -half), false, -1);
    this.wallBack.rotation.y = Math.PI;
    this.mainBoxGroup.add(this.wallBack);

    // Left Wall (hinge at bottom left: x = -half)
    this.wallLeft = createWall(new THREE.Vector3(-half, -height / 2, 0), true, -1);
    this.wallLeft.rotation.y = Math.PI / 2;
    this.mainBoxGroup.add(this.wallLeft);

    // Right Wall (hinge at bottom right: x = half)
    this.wallRight = createWall(new THREE.Vector3(half, -height / 2, 0), true, 1);
    this.wallRight.rotation.y = -Math.PI / 2;
    this.mainBoxGroup.add(this.wallRight);

    // 2. Box Lid (Lifts UP and flies off)
    this.boxLidGroup.position.set(0, height / 2 + 0.15, 0);

    const lidTopGeo = new THREE.BoxGeometry(size + 0.12, 0.35, size + 0.12);
    const lidMesh = new THREE.Mesh(lidTopGeo, velvetMat);
    lidMesh.castShadow = true;
    this.boxLidGroup.add(lidMesh);

    const lidBorderGeo = new THREE.BoxGeometry(size + 0.16, 0.05, size + 0.16);
    const lidBorder = new THREE.Mesh(lidBorderGeo, goldMat);
    lidBorder.position.y = -0.16;
    this.boxLidGroup.add(lidBorder);

    // 3. 3D Bow & Ribbons on Lid
    this.ribbonBowGroup.position.set(0, 0.22, 0);

    // Central Bow Knot
    const knotGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const knot = new THREE.Mesh(knotGeo, goldMat);
    this.ribbonBowGroup.add(knot);

    // 4 Satin ribbon loops
    const loopGeo = new THREE.TorusGeometry(0.4, 0.1, 12, 24, Math.PI * 1.35);
    for (let r = 0; r < 4; r++) {
      const loop = new THREE.Mesh(loopGeo, ribbonMat);
      loop.rotation.z = Math.PI / 3.8;
      loop.rotation.y = (Math.PI / 2) * r;
      loop.position.set(Math.cos((Math.PI / 2) * r) * 0.25, 0.12, Math.sin((Math.PI / 2) * r) * 0.25);
      this.ribbonBowGroup.add(loop);
    }
    this.boxLidGroup.add(this.ribbonBowGroup);

    // 4. Wrapping Ribbon Bands around the entire box
    const bandHGeo = new THREE.BoxGeometry(size + 0.04, 0.3, size + 0.04);
    const bandH = new THREE.Mesh(bandHGeo, ribbonMat);
    bandH.position.y = 0;
    this.ribbonBandsGroup.add(bandH);

    const bandVGeo = new THREE.BoxGeometry(0.3, height + 0.04, size + 0.04);
    const bandV = new THREE.Mesh(bandVGeo, ribbonMat);
    this.ribbonBandsGroup.add(bandV);

    this.mainBoxGroup.add(this.ribbonBandsGroup);
    this.mainBoxGroup.add(this.boxLidGroup);

    // Make the box interactive
    this.mainBoxGroup.userData = { isBox: true };
    this.boxLidGroup.userData = { isBox: true };
  }

  // Populate the mystery gifts directly onto the platform inside the box.
  public populateGifts(gifts: GiftItem[]) {
    this.giftsData = gifts;

    // Clear existing
    while (this.giftsGroup.children.length > 0) {
      this.giftsGroup.remove(this.giftsGroup.children[0]);
    }
    this.giftMeshes.clear();

    // A generous radial layout makes every surprise individually discoverable.
    const layout = [
      { id: 'gift-1', pos: new THREE.Vector3(-0.9, -0.65, 0.7) },  // Mini present (teddy inside)
      { id: 'gift-2', pos: new THREE.Vector3(0.0, -0.65, -0.9) },  // Sealed Love Letter
      { id: 'gift-3', pos: new THREE.Vector3(0.9, -0.65, 0.7) },   // Voice note cassette
      { id: 'gift-4', pos: new THREE.Vector3(-1.05, -0.65, -0.72) }, // Music box
      { id: 'gift-5', pos: new THREE.Vector3(1.05, -0.65, -0.72) },  // Polaroid photos
      { id: 'gift-6', pos: new THREE.Vector3(-0.42, -0.65, 0.04) },  // Star keepsake
      { id: 'gift-7', pos: new THREE.Vector3(0.42, -0.65, 0.04) },   // Secret promise box
      { id: 'gift-8', pos: new THREE.Vector3(0.0, -0.65, 1.12) },    // Starlight wish
      { id: 'gift-9', pos: new THREE.Vector3(-1.15, -0.65, 0.22) },  // Love token
      { id: 'gift-10', pos: new THREE.Vector3(1.15, -0.65, 0.22) },  // Midnight melody
    ];

    gifts.forEach((gift, idx) => {
      const info = layout[idx] || layout[0];
      const giftGroup = new THREE.Group();
      giftGroup.position.copy(info.pos);
      giftGroup.userData = { giftId: gift.id, basePos: info.pos.clone() };

      const mesh = this.buildIndividualGift(gift.type, gift.accentColor);
      giftGroup.add(mesh);

      // A soft luxury halo makes each object feel intentional without revealing its name.
      const ringGeo = new THREE.RingGeometry(0.17, 0.34, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(gift.accentColor),
        transparent: true,
        opacity: 0.44,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      giftGroup.add(ring);

      giftGroup.visible = false; // Hidden until box unwraps
      this.giftsGroup.add(giftGroup);
      this.giftMeshes.set(gift.id, giftGroup);

      if (gift.isCollected) {
        giftGroup.visible = false;
        this.addMeshToBin(gift.id, gift.type, gift.accentColor);
      }
    });
  }

  private buildIndividualGift(type: string, accentHex: string): THREE.Group {
    const root = new THREE.Group();
    const accent = new THREE.Color(accentHex);

    switch (type) {
      case 'wrapped': {
        // Mini present box whose lid can pop off to reveal a 3D mini teddy
        const boxGeo = new THREE.BoxGeometry(0.55, 0.5, 0.55);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x9e2a4b, roughness: 0.5 });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 0.25;
        box.castShadow = true;
        root.add(box);

        const ribGeo = new THREE.BoxGeometry(0.57, 0.08, 0.57);
        const ribMat = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.8 });
        const rib = new THREE.Mesh(ribGeo, ribMat);
        rib.position.y = 0.25;
        root.add(rib);

        // Mini Teddy poking out
        this.miniTeddyInBox = this.createMiniTeddyMesh();
        this.miniTeddyInBox.position.set(0, 0.25, 0);
        this.miniTeddyInBox.scale.set(0.65, 0.65, 0.65);
        this.miniTeddyInBox.visible = false;
        root.add(this.miniTeddyInBox);
        break;
      }
      case 'letter': {
        // Wax sealed parchment envelope
        const envGeo = new THREE.BoxGeometry(0.62, 0.08, 0.46);
        const envMat = new THREE.MeshStandardMaterial({ color: 0xfaf4e6, roughness: 0.8 });
        const env = new THREE.Mesh(envGeo, envMat);
        env.position.y = 0.05;
        root.add(env);

        const sealGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16);
        const sealMat = new THREE.MeshStandardMaterial({ color: 0x900c2a, roughness: 0.4 });
        const seal = new THREE.Mesh(sealGeo, sealMat);
        seal.position.set(0, 0.1, 0);
        root.add(seal);
        break;
      }
      case 'voice': {
        // 3D Cassette Tape
        const casGeo = new THREE.BoxGeometry(0.6, 0.14, 0.4);
        const casMat = new THREE.MeshStandardMaterial({ color: 0x241822, roughness: 0.6 });
        const cas = new THREE.Mesh(casGeo, casMat);
        cas.position.y = 0.08;
        root.add(cas);

        const reelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16);
        const reelMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
        const r1 = new THREE.Mesh(reelGeo, reelMat);
        r1.position.set(-0.14, 0.08, 0);
        const r2 = new THREE.Mesh(reelGeo, reelMat);
        r2.position.set(0.14, 0.08, 0);
        root.add(r1, r2);
        break;
      }
      case 'song': {
        // Golden Music Box Cylinder
        const cylGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.42, 24);
        const cylMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.3 });
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        cyl.position.y = 0.22;
        cyl.castShadow = true;
        root.add(cyl);

        const keyGeo = new THREE.TorusGeometry(0.09, 0.025, 8, 16);
        const key = new THREE.Mesh(keyGeo, cylMat);
        key.position.set(0, 0.48, 0);
        key.rotation.x = Math.PI / 2;
        root.add(key);
        break;
      }
      case 'photos': {
        // Standing 3D Polaroid stack
        const pGeo = new THREE.BoxGeometry(0.5, 0.05, 0.55);
        const pMat = new THREE.MeshStandardMaterial({ color: 0xfdfbf7, roughness: 0.7 });
        const p1 = new THREE.Mesh(pGeo, pMat);
        p1.position.y = 0.04;
        p1.rotation.y = 0.2;
        const p2 = new THREE.Mesh(pGeo, pMat);
        p2.position.y = 0.08;
        p2.rotation.y = -0.15;
        root.add(p1, p2);
        break;
      }
      case 'interest': {
        // Glowing celestial star sphere with ring
        const orbGeo = new THREE.SphereGeometry(0.24, 24, 24);
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x9ac4f8,
          emissive: 0x3d70b8,
          emissiveIntensity: 0.5,
          roughness: 0.2,
        });
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.y = 0.25;
        root.add(orb);

        const ringGeo = new THREE.TorusGeometry(0.36, 0.025, 12, 32);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.25;
        ring.rotation.x = Math.PI / 3;
        root.add(ring);
        break;
      }
      case 'secret': {
        // Velvet Jewel Box
        const jGeo = new THREE.BoxGeometry(0.48, 0.35, 0.42);
        const jMat = new THREE.MeshStandardMaterial({ color: 0x2b0615, roughness: 0.5, metalness: 0.2 });
        const jBox = new THREE.Mesh(jGeo, jMat);
        jBox.position.y = 0.18;
        root.add(jBox);

        const claspGeo = new THREE.BoxGeometry(0.1, 0.1, 0.44);
        const claspMat = new THREE.MeshStandardMaterial({ color: 0xffdf79, metalness: 0.9 });
        const clasp = new THREE.Mesh(claspGeo, claspMat);
        clasp.position.set(0, 0.24, 0);
        root.add(clasp);
        break;
      }
    }

    return root;
  }

  private createMiniTeddyMesh(): THREE.Group {
    const group = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ color: 0xb5784a, roughness: 0.95 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x11070e, roughness: 0.1 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x240e18 });

    // Head
    const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const head = new THREE.Mesh(headGeo, furMat);
    head.position.y = 0.3;
    group.add(head);

    // Muzzle & nose
    const muzzGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const muzz = new THREE.Mesh(muzzGeo, new THREE.MeshStandardMaterial({ color: 0xd49b77 }));
    muzz.position.set(0, 0.26, 0.18);
    const noseGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0.3, 0.26);
    group.add(muzz, nose);

    // Eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat);
    eyeL.position.set(-0.08, 0.34, 0.2);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), eyeMat);
    eyeR.position.set(0.08, 0.34, 0.2);
    group.add(eyeL, eyeR);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const earL = new THREE.Mesh(earGeo, furMat);
    earL.position.set(-0.18, 0.48, 0);
    const earR = new THREE.Mesh(earGeo, furMat);
    earR.position.set(0.18, 0.48, 0);
    group.add(earL, earR);

    // Body & Heart
    const bodyGeo = new THREE.SphereGeometry(0.28, 16, 16);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.position.y = 0;
    group.add(body);

    const heartGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const heartMat = new THREE.MeshStandardMaterial({ color: 0x990022 });
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(0.06, 0.05, 0.22);
    group.add(heart);

    return group;
  }

  // 3D Collection Bin / Basket situated at the side
  private createBin() {
    // Kept close enough to the unfolded box to stay in frame on a portrait phone.
    this.binGroup.position.set(2.85, -0.65, 0.6);

    // Woven golden rim
    const rimGeo = new THREE.TorusGeometry(0.78, 0.045, 12, 36);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.35 });
    const rim = new THREE.Mesh(rimGeo, goldMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.42;
    this.binGroup.add(rim);

    // Bin body
    const bodyGeo = new THREE.CylinderGeometry(0.74, 0.54, 0.7, 24, 1, true);
    const binMat = new THREE.MeshStandardMaterial({
      color: 0x5a1830,
      roughness: 0.7,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bodyGeo, binMat);
    body.position.y = 0.08;
    this.binGroup.add(body);

    // Cushion floor inside
    const cushionGeo = new THREE.CylinderGeometry(0.56, 0.5, 0.16, 24);
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x330818, roughness: 0.9 });
    const cushion = new THREE.Mesh(cushionGeo, cushionMat);
    cushion.position.y = -0.16;
    this.binGroup.add(cushion);

    this.binGroup.add(this.binItemsGroup);
  }

  public addMeshToBin(giftId: string, type: string, accentHex: string) {
    if (this.binItemsGroup.getObjectByName(giftId)) return;

    const count = this.binItemsGroup.children.length;
    const mini = this.buildIndividualGift(type, accentHex);
    mini.name = giftId;
    mini.scale.set(0.48, 0.48, 0.48);

    const angle = count * 0.95;
    const r = Math.min(0.28, 0.08 + count * 0.04);
    mini.position.set(Math.cos(angle) * r, -0.05 + count * 0.06, Math.sin(angle) * r);
    mini.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);

    this.binItemsGroup.add(mini);
  }

  // 3D Parabolic projectile arc throw of opened item into bin
  public launchItemIntoBin(giftId: string, onComplete?: () => void) {
    const meshGroup = this.giftMeshes.get(giftId);
    if (!meshGroup) {
      if (onComplete) onComplete();
      return;
    }

    const start = meshGroup.position.clone();
    const target = this.binGroup.position.clone().add(new THREE.Vector3(0, 0.25, 0));

    let progress = 0;
    const duration = 1100;
    const startTime = performance.now();

    const arcStep = (now: number) => {
      const elapsed = now - startTime;
      progress = Math.min(1, elapsed / duration);

      // Smooth easing
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
      meshGroup.position.lerpVectors(start, target, ease);
      // High parabolic arc
      meshGroup.position.y += Math.sin(progress * Math.PI) * 1.9;

      // Shrink & spin
      const s = 1 - progress * 0.5;
      meshGroup.scale.set(s, s, s);
      meshGroup.rotation.y += 0.12;
      meshGroup.rotation.x += 0.06;

      if (progress < 1) {
        requestAnimationFrame(arcStep);
      } else {
        meshGroup.visible = false;
        const gift = this.giftsData.find((g) => g.id === giftId);
        if (gift) {
          this.addMeshToBin(giftId, gift.type, gift.accentColor);
        }
        if (onComplete) onComplete();
      }
    };
    requestAnimationFrame(arcStep);
  }

  // Cute 3D Plush Walking Teddy Bear
  private createTeddyCharacter() {
    this.teddyGroup.position.set(7.5, -1.05, 0.8); // Offscreen right initially

    const furMat = new THREE.MeshStandardMaterial({ color: 0xc48652, roughness: 0.95 });
    const innerEarMat = new THREE.MeshStandardMaterial({ color: 0xf5b5be, roughness: 0.9 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x11070e, roughness: 0.1, metalness: 0.9 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x240e18, roughness: 0.4 });

    // 1. Tummy / Body
    const bodyGeo = new THREE.SphereGeometry(0.58, 24, 24);
    bodyGeo.scale(1, 1.25, 0.9);
    const body = new THREE.Mesh(bodyGeo, furMat);
    body.position.y = 0.7;
    body.castShadow = true;
    this.teddyGroup.add(body);

    // Heart embroidery
    const heartGeo = new THREE.SphereGeometry(0.12, 16, 16);
    heartGeo.scale(1.2, 1, 0.3);
    const heart = new THREE.Mesh(heartGeo, new THREE.MeshStandardMaterial({ color: 0x900c2a }));
    heart.position.set(0.12, 0.85, 0.45);
    heart.rotation.z = -0.2;
    this.teddyGroup.add(heart);

    // 2. Head
    this.teddyHead.position.set(0, 1.45, 0);
    const headGeo = new THREE.SphereGeometry(0.48, 24, 24);
    const head = new THREE.Mesh(headGeo, furMat);
    head.castShadow = true;
    this.teddyHead.add(head);

    // Muzzle & Button Nose
    const snout = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xdfb08c, roughness: 0.9 })
    );
    snout.scale.set(1.15, 0.85, 1);
    snout.position.set(0, -0.05, 0.38);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), noseMat);
    nose.position.set(0, 0.03, 0.55);
    this.teddyHead.add(snout, nose);

    // Sweet Smiling Mouth (Friendly curved smile ◡)
    const smileGeo = new THREE.TorusGeometry(0.075, 0.016, 8, 16, Math.PI * 0.75);
    const smileMat = new THREE.MeshBasicMaterial({ color: 0x2e0b19 });
    const smile = new THREE.Mesh(smileGeo, smileMat);
    smile.position.set(0, -0.06, 0.54);
    smile.rotation.x = 0.2;
    smile.rotation.z = Math.PI * 1.12;
    this.teddyHead.add(smile);

    // Rosy Blushing Cheeks
    const blushGeo = new THREE.SphereGeometry(0.08, 12, 12);
    blushGeo.scale(1.2, 0.7, 0.3);
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xffa8b8, roughness: 0.8 });
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.25, -0.02, 0.42);
    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushR.position.set(0.25, -0.02, 0.42);
    this.teddyHead.add(blushL, blushR);

    // Friendly Eyes with Dual Sparkles
    const eyeGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.16, 0.09, 0.42);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.16, 0.09, 0.42);

    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const spL1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), sparkMat);
    spL1.position.set(-0.145, 0.115, 0.47);
    const spR1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), sparkMat);
    spR1.position.set(0.175, 0.115, 0.47);
    const spL2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), sparkMat);
    spL2.position.set(-0.17, 0.075, 0.47);
    const spR2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), sparkMat);
    spR2.position.set(0.145, 0.075, 0.47);
    this.teddyHead.add(eyeL, eyeR, spL1, spR1, spL2, spR2);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const inGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const earL = new THREE.Mesh(earGeo, furMat);
    earL.position.set(-0.36, 0.34, 0);
    const inL = new THREE.Mesh(inGeo, innerEarMat);
    inL.position.set(-0.36, 0.34, 0.06);
    const earR = new THREE.Mesh(earGeo, furMat);
    earR.position.set(0.36, 0.34, 0);
    const inR = new THREE.Mesh(inGeo, innerEarMat);
    inR.position.set(0.36, 0.34, 0.06);
    this.teddyHead.add(earL, inL, earR, inR);
    this.teddyGroup.add(this.teddyHead);

    // 3. Legs
    const legGeo = new THREE.CapsuleGeometry(0.16, 0.32, 12, 12);
    this.teddyLeftLeg.position.set(-0.28, 0.32, 0);
    const legL = new THREE.Mesh(legGeo, furMat);
    legL.position.y = -0.16;
    this.teddyLeftLeg.add(legL);

    this.teddyRightLeg.position.set(0.28, 0.32, 0);
    const legR = new THREE.Mesh(legGeo, furMat);
    legR.position.y = -0.16;
    this.teddyRightLeg.add(legR);
    this.teddyGroup.add(this.teddyLeftLeg, this.teddyRightLeg);

    // 4. Arms
    const armGeo = new THREE.CapsuleGeometry(0.14, 0.38, 12, 12);
    this.teddyLeftArm.position.set(-0.52, 0.95, 0);
    const armL = new THREE.Mesh(armGeo, furMat);
    armL.position.y = -0.18;
    this.teddyLeftArm.add(armL);

    this.teddyRightArm.position.set(0.52, 0.95, 0);
    const armR = new THREE.Mesh(armGeo, furMat);
    armR.position.y = -0.18;
    this.teddyRightArm.add(armR);
    this.teddyGroup.add(this.teddyLeftArm, this.teddyRightArm);
  }

  // 3D Arched Door
  private createDoor() {
    this.doorGroup.position.set(0, 0, -4.5);
    this.doorGroup.visible = false;

    // Outer door frame
    const frameGeo = new THREE.BoxGeometry(2.6, 4.4, 0.25);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd39a62, emissive: 0x3b1808, emissiveIntensity: 0.22, roughness: 0.42, metalness: 0.28 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 1.1;
    this.doorGroup.add(frame);

    // Hinged door panel (Pivot at x = -0.95)
    this.doorHingedPanel.position.set(-0.95, 1.1, 0);
    const panelGeo = new THREE.BoxGeometry(1.9, 4.1, 0.12);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xb97845, emissive: 0x2e1307, emissiveIntensity: 0.16, roughness: 0.46, metalness: 0.2 });
    const panel = new THREE.Mesh(panelGeo, woodMat);
    panel.position.set(0.95, 0, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    this.doorHingedPanel.add(panel);

    // Brass handle
    const handleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.26, 12);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    this.doorHandle = new THREE.Mesh(handleGeo, brassMat);
    this.doorHandle.rotation.z = Math.PI / 2;
    this.doorHandle.position.set(1.65, 0, 0.12);
    this.doorHingedPanel.add(this.doorHandle);

    this.doorGroup.add(this.doorHingedPanel);

    // Portal light inside doorway
    this.doorLight = new THREE.PointLight(0xffecd0, 0, 14, 1.4);
    this.doorLight.position.set(0, 1.5, -0.6);
    this.doorGroup.add(this.doorLight);

    // Door backdrop
    const bgGeo = new THREE.PlaneGeometry(1.9, 4.1);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0xffd8a0 });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.position.set(0, 1.1, -0.15);
    this.doorGroup.add(bg);

    panel.userData = { isDoor: true };
    this.doorHandle.userData = { isDoor: true };
  }

  // Trigger the 3D ribbon untying and box explosion / walls falling down
  public startUnwrappingAnimation(onComplete?: () => void) {
    this.isUnwrapping = true;
    void this.isUnwrapping; // read to avoid unused warning
    let progress = 0;
    const duration = 1800; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      progress = Math.min(1, elapsed / duration);
      this.unwrapProgress = progress;

      // Phase 1: Ribbon bow unties & scales away (0 to 0.4)
      const bowScale = Math.max(0.001, 1 - Math.min(1, progress * 2.5));
      this.ribbonBowGroup.scale.set(bowScale, bowScale, bowScale);
      this.ribbonBandsGroup.scale.set(bowScale, bowScale, bowScale);

      // Phase 2: Lid lifts up and rotates off (0.2 to 0.8)
      if (progress > 0.2) {
        const lidProg = (progress - 0.2) / 0.6;
        this.boxLidGroup.position.y = 1.1 + lidProg * 2.6;
        this.boxLidGroup.position.z = -lidProg * 1.8;
        this.boxLidGroup.rotation.x = -lidProg * 0.8;
        this.boxLidGroup.scale.setScalar(Math.max(0.001, 1 - lidProg * 0.7));
      }

      // Phase 3: Walls fall down flat like explosion box (0.4 to 1.0)
      if (progress > 0.4) {
        const wallProg = (progress - 0.4) / 0.6;
        // Spring easing for physical flop onto floor
        const angle = Math.min(Math.PI / 2, wallProg * (Math.PI / 2) * 1.08);

        this.wallFront.rotation.x = angle;
        this.wallBack.rotation.x = -angle;
        this.wallLeft.rotation.z = angle;
        this.wallRight.rotation.z = -angle;

        // Flare interior golden light
        this.interiorWarmLight.intensity = wallProg * 4.2;

        // Show gifts emerging
        this.giftMeshes.forEach((mesh, id) => {
          const gift = this.giftsData.find((g) => g.id === id);
          if (gift && !gift.isCollected) {
            mesh.visible = true;
            mesh.scale.setScalar(Math.min(1, wallProg * 1.1));
          }
        });
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.boxLidGroup.visible = false;
        this.ribbonBandsGroup.visible = false;
        // Final rest: walls flat on floor
        this.wallFront.rotation.x = Math.PI / 2;
        this.wallBack.rotation.x = -Math.PI / 2;
        this.wallLeft.rotation.z = Math.PI / 2;
        this.wallRight.rotation.z = -Math.PI / 2;
        if (onComplete) onComplete();
      }
    };
    requestAnimationFrame(step);
  }

  // Pop out the mini teddy inside Gift 1
  public triggerMiniTeddyPop() {
    if (!this.miniTeddyInBox || this.miniTeddyPopped) return;
    this.miniTeddyPopped = true;
    this.miniTeddyInBox.visible = true;
    this.miniTeddyInBox.position.y = 0.2;

    let p = 0;
    const anim = () => {
      p += 0.08;
      this.miniTeddyInBox.position.y = 0.35 + Math.sin(p) * 0.15;
      this.miniTeddyInBox.rotation.y += 0.05;
      if (p < Math.PI * 2) {
        requestAnimationFrame(anim);
      }
    };
    requestAnimationFrame(anim);
  }

  // Teddy character walk in or out
  public setTeddyWalk(entering: boolean) {
    this.teddyWalking = true;
    this.teddyDirection = entering ? 1 : -1;
  }

  public stopTeddyWalk() {
    this.teddyWalking = false;
  }

  // State transitions from orchestrator
  public setState(newState: ExperienceState) {
    this.currentState = newState;
    const isMobile = this.container.clientWidth < 768;

    switch (newState) {
      case 'BOOT':
      case 'LOCKED':
      case 'NAME_ENTRY':
        this.cameraTargetPos.set(0, isMobile ? 2.6 : 2.2, isMobile ? 7.2 : 5.8);
        this.cameraLookAt.set(0, 0, 0);
        break;

      case 'UNLOCKED':
        this.cameraTargetPos.set(0, isMobile ? 2.8 : 2.4, isMobile ? 6.2 : 4.8);
        break;

      case 'BOX_OPEN':
      case 'GIFT_SELECTION':
      case 'GIFT_CONTENT':
      case 'GIFT_COMPLETED':
      case 'COLLECTING':
        // A wider mobile frame deliberately includes both the unfolded box and bin.
        this.cameraTargetPos.set(isMobile ? 0.65 : 0, isMobile ? 4.7 : 3.8, isMobile ? 9.2 : 3.8);
        this.cameraLookAt.set(isMobile ? 0.65 : 0, -0.4, 0);
        break;

      case 'ALL_GIFTS_COMPLETED':
      case 'TEDDY_INTRO':
      case 'TEDDY_QUESTION':
      case 'TEDDY_RESPONSE':
      case 'COLLECTION_TAKEN':
        // Camera frames the bin and teddy without sending either beyond a narrow viewport.
        this.cameraTargetPos.set(isMobile ? 2.5 : 1.5, isMobile ? 2.9 : 1.8, isMobile ? 8.2 : 4.4);
        this.cameraLookAt.set(2.4, -0.1, 0.6);
        break;

      case 'NOTIFICATION':
      case 'DOOR_READY':
      case 'DOOR_OPENING':
      case 'FINAL_HANDOFF':
        this.doorGroup.visible = true;
        this.cameraTargetPos.set(0, isMobile ? 2.0 : 1.6, isMobile ? 3.6 : 2.4);
        this.cameraLookAt.set(0, 1.1, -4.5);
        if (newState === 'DOOR_OPENING' || newState === 'FINAL_HANDOFF') {
          this.isDoorOpening = true;
        }
        break;
    }

    this.syncOrbitToPreset();
  }

  private syncOrbitToPreset() {
    const offset = this.cameraTargetPos.clone().sub(this.cameraLookAt);
    this.orbitRadius = Math.max(2.5, offset.length());
    this.targetOrbitYaw = Math.atan2(offset.x, offset.z);
    this.targetOrbitPitch = Math.asin(THREE.MathUtils.clamp(offset.y / this.orbitRadius, -0.96, 0.96));
    this.orbitYaw = this.targetOrbitYaw;
    this.orbitPitch = this.targetOrbitPitch;
  }

  private updatePointerCoordinates(event: PointerEvent) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private selectAtPointer() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    if (hits.length === 0) return;

    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;

      if (obj.userData?.isDoor) {
        this.callbacks.onDoorClick();
        return;
      }

      while (obj && obj !== this.scene) {
        if (obj.userData?.giftId) {
          const giftId = obj.userData.giftId;
          const gift = this.giftsData.find((g) => g.id === giftId);
          if (gift && !gift.isCollected) {
            this.callbacks.onGiftClick(giftId);
            return;
          }
        }
        if (obj.userData?.isBox) {
          this.callbacks.onBoxClick();
          return;
        }
        obj = obj.parent;
      }
    }
  }

  // Pointer handling: drag anywhere for a full horizontal orbit and a comfortable vertical tilt.
  private onPointerDown = (event: PointerEvent) => {
    if (this.activePointerId !== null) return;
    this.activePointerId = event.pointerId;
    this.isDragging = false;
    this.pointerStart.set(event.clientX, event.clientY);
    this.pointerLast.copy(this.pointerStart);
    this.updatePointerCoordinates(event);
    this.container.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    this.updatePointerCoordinates(event);
    if (event.pointerId !== this.activePointerId) return;

    const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    if (moved > 6) this.isDragging = true;
    if (!this.isDragging) return;

    const dx = event.clientX - this.pointerLast.x;
    const dy = event.clientY - this.pointerLast.y;
    this.targetOrbitYaw -= dx * 0.009;
    // Keep the camera on the upper hemisphere: full horizontal orbit, never underneath the box.
    this.targetOrbitPitch = THREE.MathUtils.clamp(this.targetOrbitPitch + dy * 0.006, 0.12, Math.PI / 2 - 0.08);
    this.pointerLast.set(event.clientX, event.clientY);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.activePointerId) return;
    this.updatePointerCoordinates(event);
    if (!this.isDragging) this.selectAtPointer();
    this.container.releasePointerCapture?.(event.pointerId);
    this.activePointerId = null;
  };

  private onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === this.activePointerId) this.activePointerId = null;
  };

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    // Widen FOV on narrow (mobile portrait) screens so 3D content fits
    this.camera.fov = w < 768 ? 70 : 45;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    // Re-apply state to adjust camera positions for new screen size
    this.setState(this.currentState);
  };

  // Main Render Loop
  private renderLoop = (now?: number) => {
    this.animId = requestAnimationFrame(this.renderLoop);
    this.clock.update(now);
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsed();

    // 1. Camera orbit & Lerp. Yaw has no bounds, enabling a true 360 degree rotation.
    this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, this.targetOrbitYaw, 0.18);
    this.orbitPitch = THREE.MathUtils.lerp(this.orbitPitch, this.targetOrbitPitch, 0.18);
    const horizontalRadius = this.orbitRadius * Math.cos(this.orbitPitch);
    const desiredCamera = new THREE.Vector3(
      this.cameraLookAt.x + horizontalRadius * Math.sin(this.orbitYaw),
      this.cameraLookAt.y + this.orbitRadius * Math.sin(this.orbitPitch),
      this.cameraLookAt.z + horizontalRadius * Math.cos(this.orbitYaw),
    );
    this.camera.position.lerp(desiredCamera, 0.12);
    this.currentLookAt.lerp(this.cameraLookAt, 0.05);
    this.camera.lookAt(this.currentLookAt);

    // 2. Dust Particles floating
    if (this.particlePositions) {
      for (let i = 1; i < this.particlePositions.length; i += 3) {
        this.particlePositions[i] += Math.sin(elapsed + i) * 0.0025;
        if (this.particlePositions[i] > 5) this.particlePositions[i] = -0.5;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Subtle floating bobbing for gifts on the unfolded floor
    if (this.unwrapProgress >= 1) {
      let idx = 0;
      this.giftMeshes.forEach((mesh) => {
        if (mesh.visible) {
          const base = mesh.userData.basePos as THREE.Vector3;
          mesh.position.y = base.y + Math.sin(elapsed * 2.5 + idx * 0.8) * 0.035;
          mesh.rotation.y += 0.004;
          idx++;
        }
      });
    }

    // 4. Teddy Character Movement
    if (this.teddyWalking) {
      if (this.teddyDirection === 1) {
        // Walking in to stop by the bin (x: 7.5 -> 3.9)
        this.teddyGroup.position.x = THREE.MathUtils.lerp(this.teddyGroup.position.x, 3.9, 0.035);
        this.teddyGroup.rotation.y = -Math.PI / 2; // Facing left toward bin
        const walk = Math.sin(elapsed * 12);
        this.teddyLeftLeg.rotation.x = walk * 0.45;
        this.teddyRightLeg.rotation.x = -walk * 0.45;
        this.teddyLeftArm.rotation.x = -walk * 0.45;
        this.teddyRightArm.rotation.x = walk * 0.45;
        this.teddyGroup.position.y = -1.05 + Math.abs(walk) * 0.08;

        if (Math.abs(this.teddyGroup.position.x - 3.9) < 0.05) {
          this.teddyWalking = false;
          this.teddyLeftLeg.rotation.x = 0;
          this.teddyRightLeg.rotation.x = 0;
          this.teddyGroup.rotation.y = -0.4; // Facing camera & bin
        }
      } else {
        // Walking away out of the screen (x: 3.9 -> 8.5)
        this.teddyGroup.rotation.y = Math.PI / 2; // Facing right
        this.teddyGroup.position.x += delta * 2.5;
        const walk = Math.sin(elapsed * 14);
        this.teddyLeftLeg.rotation.x = walk * 0.5;
        this.teddyRightLeg.rotation.x = -walk * 0.5;
        this.teddyGroup.position.y = -1.05 + Math.abs(walk) * 0.09;
        if (this.teddyGroup.position.x > 8.5) {
          this.teddyWalking = false;
          this.teddyGroup.visible = false;
        }
      }
    } else if (this.currentState === 'TEDDY_QUESTION') {
      // Cute idle breathing & head tilting
      this.teddyHead.rotation.z = Math.sin(elapsed * 2) * 0.15;
      this.teddyHead.rotation.y = Math.sin(elapsed * 1.5) * 0.2 - 0.2;
      this.teddyLeftArm.rotation.z = 0.25 + Math.sin(elapsed * 3) * 0.1;
      this.teddyRightArm.rotation.z = -0.25 - Math.sin(elapsed * 3) * 0.1;
    }

    // 5. Door Opening
    if (this.doorGroup.visible && this.isDoorOpening) {
      this.doorOpenProgress = THREE.MathUtils.lerp(this.doorOpenProgress, 1, 0.04);
      this.doorHingedPanel.rotation.y = this.doorOpenProgress * (Math.PI / 2) * 0.95;
      this.doorHandle.rotation.z = (Math.PI / 2) - this.doorOpenProgress * 0.5;
      this.doorLight.intensity = this.doorOpenProgress * 8.5;
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this.onResize);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerup', this.onPointerUp);
    this.container.removeEventListener('pointercancel', this.onPointerCancel);
    this.clock.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
