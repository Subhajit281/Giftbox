import * as THREE from 'three';
import type { GiftItem } from '../content/giftData';
import type { ExperienceState } from '../state/ExperienceState';

const ROOM_X = 80; // the proposal room lives far from the gift world, so no hiding/unhiding is needed
const BIRTHDAY_ROOM_X = 40;
const FLOOR_Y = -1.15;
const SILHOUETTE = true; // false = coloured characters instead of dark silhouettes

interface Person {
  root: THREE.Group;
  lean: THREE.Group;
  /** Hip joint — swings the whole leg */
  legL: THREE.Group;
  legR: THREE.Group;
  /** Knee joint — child of each leg */
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  /** Shoulder joint */
  armL: THREE.Group;
  armR: THREE.Group;
  /** Elbow joint — child of each arm */
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  /** Hand anchors (rose / gestures) */
  handL: THREE.Group;
  handR: THREE.Group;
  head: THREE.Group;
}

const lerp = THREE.MathUtils.lerp;
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const easeOut = (p: number) => 1 - Math.pow(1 - p, 2);
function makeHeartGeometry(depth: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const x = (16 * Math.pow(Math.sin(t), 3)) / 16;
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.center();
  return geo;
}

/** Cupped, rounded petal: base at y=0, tip at y=height. cup curls the sides inward, curl flares the tip outward. */
function makePetalGeometry(width: number, height: number, cup: number, curl: number) {
  const geo = new THREE.PlaneGeometry(1, 1, 8, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + 0.5; // 0 = base, 1 = tip
    const px = x * Math.sin(Math.PI * (0.12 + 0.76 * y)); // narrow base, wide middle, rounded tip
    pos.setXYZ(i, px * width, y * height, -cup * Math.pow(px * 2, 2) * width + curl * y * y * height);
  }
  geo.computeVertexNormals();
  return geo;
}

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

  // Birthday room shown before the gift journey.
  private birthdayRoomGroup = new THREE.Group();
  private birthdayExitDoor = new THREE.Group();

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
  private isMobile = false;
  private pixelRatio = 1;
  private readonly minPixelRatio = 1;
  private warming = false;
  private disposed = false;
  private lastFrameTime = 0;
  private frameIndex = 0;
  private sampledFrames = 0;
  private slowFrames = 0;
  private lastW = 0;
  private lastH = 0;
  private resizeRaf: number | null = null;
  private desiredCamera = new THREE.Vector3();
  // Proposal room
  private roomGroup = new THREE.Group();
  private roomKeyLight!: THREE.PointLight;
  private roomRimLight!: THREE.PointLight;
  private proposalHeart!: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
  private proposalHalo!: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private boy!: Person;
  private girl!: Person;
  private rose!: THREE.Group;
  private sparkles!: THREE.Points;
  private sparkleData!: { start: Float32Array; vel: Float32Array; delay: Float32Array };
  private orbitLocked = false;
  private tmpV = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

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
    this.isMobile = container.clientWidth < 768;
    this.lastW = container.clientWidth;
    this.lastH = container.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    // Phones gain much more from a steady frame rate than from imperceptible extra pixels.
    this.pixelRatio = Math.min(window.devicePixelRatio, this.isMobile ? 1.25 : 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
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
    this.createBirthdayRoom();

    this.scene.add(this.mainBoxGroup);
    this.scene.add(this.giftsGroup);
    this.scene.add(this.binGroup);
    this.scene.add(this.teddyGroup);
    this.scene.add(this.doorGroup);
    this.scene.add(this.birthdayRoomGroup);

    // Proposal room
    this.createProposalRoom();
    this.scene.add(this.roomGroup);

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
    const shadowSize = this.isMobile ? 512 : 1024;
    spot.shadow.mapSize.set(shadowSize, shadowSize);
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 24;
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
    const floorMat = this.isMobile
      ? new THREE.MeshLambertMaterial({ color: 0x180b14 })
      : new THREE.MeshStandardMaterial({ color: 0x180b14, roughness: 0.68, metalness: 0.16 });
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
    const count = this.isMobile ? 120 : 220;
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
      case 'letters':
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
  const target = this.binGroup.position
    .clone()
    .add(new THREE.Vector3(0, 0.25, 0));

  const duration = 1100;
  let startTime = -1;

  const arcStep = (now: number) => {
    if (startTime < 0) startTime = now;

    const progress = Math.min(1, (now - startTime) / duration);

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
    this.teddyGroup.visible = false;
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

  private createBirthdayRoom() {
    const room = this.birthdayRoomGroup;
    room.position.set(BIRTHDAY_ROOM_X, 0, 0);
    room.visible = false;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 24),
      new THREE.MeshStandardMaterial({ color: 0x351021, roughness: 0.54, metalness: 0.16 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    room.add(floor);

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 12),
      new THREE.MeshStandardMaterial({ color: 0x6f1c41, emissive: 0x260613, emissiveIntensity: 0.3, roughness: 0.88 }),
    );
    backWall.position.set(0, 4.8, -5.8);
    room.add(backWall);

    // A few bright birthday cards on the wall, each slightly turned like real paper cards.
    const cardColors = [0xffe7a7, 0xffd5e1, 0xd5f2e6, 0xf9c5d6, 0xffefd0];
    for (let i = 0; i < 9; i++) {
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.2),
        new THREE.MeshBasicMaterial({ color: cardColors[i % cardColors.length] }),
      );
      card.position.set(-5.6 + (i % 5) * 2.8, 3.0 + Math.floor(i / 5) * 1.5, -5.66);
      card.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.05 + (i % 3) * 0.025);
      room.add(card);

      const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.07),
        new THREE.MeshBasicMaterial({ color: 0xbc2853 }),
      );
      ribbon.position.copy(card.position);
      ribbon.position.z += 0.01;
      ribbon.rotation.z = card.rotation.z;
      room.add(ribbon);
    }

    // Warm fairy lights strung across the birthday wall.
    const wire = new THREE.Mesh(
      new THREE.TorusGeometry(6.9, 0.012, 6, 56, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xd6a949 }),
    );
    wire.position.set(0, 4.7, -5.63);
    wire.rotation.z = Math.PI;
    room.add(wire);
    const bulbGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe29b });
    for (let i = 0; i < 19; i++) {
      const u = i / 18;
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set((u - 0.5) * 13.8, 4.7 - Math.sin(u * Math.PI) * 1.2, -5.58);
      room.add(bulb);
    }

    // Balloons use low-poly, shared geometry/materials and are static: decoration without a frame cost.
    const balloonGeo = new THREE.SphereGeometry(0.34, this.isMobile ? 10 : 14, this.isMobile ? 8 : 12);
    const balloonColors = [0xe84b72, 0xf2c35b, 0xffaac0, 0xb78ce3];
    for (let i = 0; i < 22; i++) {
      const balloon = new THREE.Mesh(
        balloonGeo,
        new THREE.MeshStandardMaterial({ color: balloonColors[i % balloonColors.length], roughness: 0.32, metalness: 0.08 }),
      );
      const x = -6.2 + (i % 8) * 1.75;
      const y = i % 3 === 0 ? 1.0 : 4.8 + (i % 4) * 0.18;
      balloon.position.set(x, y, -4.7 + (i % 3) * 0.34);
      balloon.scale.set(0.88, 1.15, 0.88);
      room.add(balloon);
    }

    const warm = new THREE.PointLight(0xffcc86, 3.6, 18, 1.8);
    warm.position.set(0, 3.5, 2.5);
    room.add(warm);
    const rose = new THREE.PointLight(0xd5356b, 1.8, 14, 2);
    rose.position.set(-4.5, 1.8, 1);
    room.add(rose);

    // This door stays hidden until the cake has been cut, then becomes the way to the gift room.
    this.birthdayExitDoor.position.set(0, 1.0, -5.52);
    this.birthdayExitDoor.visible = false;
    const exitFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 3.55, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xf0bd63, emissive: 0x3f1808, emissiveIntensity: 0.32, roughness: 0.36, metalness: 0.5 }),
    );
    const exitPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.76, 3.2, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x761e45, emissive: 0x2a0617, emissiveIntensity: 0.26, roughness: 0.42, metalness: 0.18 }),
    );
    exitPanel.position.z = 0.08;
    const exitKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf6d47c, metalness: 0.9, roughness: 0.18 }),
    );
    exitKnob.position.set(0.56, -0.12, 0.16);
    this.birthdayExitDoor.add(exitFrame, exitPanel, exitKnob);
    room.add(this.birthdayExitDoor);
  }

  public enterBirthdayRoom() {
    this.doorGroup.visible = false;
    this.birthdayRoomGroup.visible = true;
  }

  public leaveBirthdayRoom() {
    this.birthdayRoomGroup.visible = false;
    this.birthdayExitDoor.visible = false;
    this.doorGroup.visible = false;
    this.isDoorOpening = false;
    this.doorOpenProgress = 0;
    this.doorHingedPanel.rotation.y = 0;
    this.doorHandle.rotation.z = Math.PI / 2;
    this.doorLight.intensity = 0;
  }

  // Trigger the 3D ribbon untying and box explosion / walls falling down
 public startUnwrappingAnimation(onComplete?: () => void) {
  this.isUnwrapping = true;
  void this.isUnwrapping; // read to avoid unused warning

  const duration = 1800; // ms
  let startTime = -1;

  const step = (now: number) => {
    if (startTime < 0) startTime = now;

    const progress = Math.min(1, (now - startTime) / duration);
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
      this.boxLidGroup.scale.setScalar(
        Math.max(0.001, 1 - lidProg * 0.7)
      );
    }

    // Phase 3: Walls fall down flat like explosion box (0.4 to 1.0)
    if (progress > 0.4) {
      const wallProg = (progress - 0.4) / 0.6;

      // Spring easing for physical flop onto floor
      const angle = Math.min(
        Math.PI / 2,
        wallProg * (Math.PI / 2) * 1.08
      );

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
    if (entering) {
      this.teddyGroup.visible = true;
      this.teddyGroup.position.x = 7.5;
    }
    this.teddyWalking = true;
    this.teddyDirection = entering ? 1 : -1;
  }

  // State transitions from orchestrator
  public setState(newState: ExperienceState) {
    this.currentState = newState;
    const isMobile = this.container.clientWidth < 768;
    this.orbitLocked = false;

    switch (newState) {
      case 'BOOT':
      case 'LOCKED':
      case 'NAME_ENTRY':
        this.cameraTargetPos.set(0, isMobile ? 2.6 : 2.2, isMobile ? 7.2 : 5.8);
        this.cameraLookAt.set(0, 0, 0);
        break;

      case 'ENTRY_DOOR':
      case 'ENTRY_DOOR_OPENING':
        this.doorGroup.visible = true;
        this.cameraTargetPos.set(0, isMobile ? 2.0 : 1.6, isMobile ? 3.6 : 2.4);
        this.cameraLookAt.set(0, 1.1, -4.5);
        if (newState === 'ENTRY_DOOR_OPENING') this.isDoorOpening = true;
        break;

      case 'BIRTHDAY_COUNTDOWN':
      case 'BIRTHDAY_WISH':
      case 'CAKE_CUTTING':
      case 'GIFT_TRANSITION':
        this.birthdayExitDoor.visible = false;
        this.orbitLocked = true;
        this.cameraTargetPos.set(BIRTHDAY_ROOM_X, isMobile ? 1.55 : 1.45, isMobile ? 6.9 : 6.1);
        this.cameraLookAt.set(BIRTHDAY_ROOM_X, 1.0, -1.6);
        break;

      case 'GIFT_DOOR_READY':
        this.birthdayExitDoor.visible = true;
        this.orbitLocked = true;
        this.cameraTargetPos.set(BIRTHDAY_ROOM_X, isMobile ? 1.55 : 1.45, isMobile ? 6.9 : 6.1);
        this.cameraLookAt.set(BIRTHDAY_ROOM_X, 1.0, -1.6);
        break;

      case 'GIFT_READY':
        this.doorGroup.visible = false;
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

      case 'PROPOSAL_ENTER':
      case 'PROPOSAL_ASK':
      case 'PROPOSAL_ANSWER':
        this.orbitLocked = true;
        this.cameraTargetPos.set(ROOM_X, isMobile ? 0.9 : 1.0, isMobile ? 4.4 : 5.2);
        this.cameraLookAt.set(ROOM_X, 0.5, 0);
        break;

      case 'PROPOSAL_ACCEPTED':
      case 'PROPOSAL_KISS':
      case 'PROPOSAL_NOTIFICATION':
        this.orbitLocked = true;
        this.cameraTargetPos.set(ROOM_X, 0.8, 3.6); // slow push-in for the kiss
        this.cameraLookAt.set(ROOM_X, 0.5, 0);
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
    //this.updatePointerCoordinates(event);
    if (event.pointerId !== this.activePointerId) return;

    const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    if (moved > 6) this.isDragging = true;
    if (!this.isDragging) return;
    if (this.orbitLocked) return;

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
    if (this.resizeRaf !== null) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (!w || !h || (w === this.lastW && h === this.lastH)) return;
      this.lastW = w;
      this.lastH = h;
      const wasMobile = this.isMobile;
      this.isMobile = w < 768;
      this.camera.aspect = w / h;
      this.camera.fov = this.isMobile ? 70 : 45;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      // Only re-frame when crossing the phone/desktop breakpoint, so URL-bar resizes don't reset the user's view.
      if (wasMobile !== this.isMobile) this.setState(this.currentState);
    });
  };

    // Compile every shader and upload every geometry while the screen is still idle (BOOT),
  // so nothing hitches during the unwrap, gift reveal, teddy walk or door.
  public async warmUp(): Promise<void> {
    if (this.disposed) return;
    this.warming = true;
    const saved: Array<{ o: THREE.Object3D; visible: boolean; culled: boolean }> = [];
    try {
      await this.renderer.compileAsync(this.scene, this.camera); // current light set
      this.scene.traverse((o) => {
        saved.push({ o, visible: o.visible, culled: o.frustumCulled });
        o.visible = true;            // gifts, teddy, door + its light (changes light count)
        o.frustumCulled = false;
      });
      await this.renderer.compileAsync(this.scene, this.camera); // full light set
      this.renderer.render(this.scene, this.camera);             // uploads all geometry + shadow programs
    } finally {
      for (const s of saved) {
        s.o.visible = s.visible;
        s.o.frustumCulled = s.culled;
      }
      if (!this.disposed) this.renderer.render(this.scene, this.camera); // overwrite the warm-up frame
      this.warming = false;
      this.frameIndex = 0;
    }
  }

  private damp(rate: number, delta: number) {
    return 1 - Math.exp(-rate * delta);
  }

  // Adaptive resolution: if the GPU can't hold ~40fps, step the pixel ratio down (never back up, so no flicker).
  private sampleFrame(delta: number) {
    if (this.frameIndex++ < 60 || this.pixelRatio <= this.minPixelRatio) return;
    this.sampledFrames++;
    if (delta > 0.026) this.slowFrames++;
    if (this.sampledFrames >= 45) {
      if (this.slowFrames > 18) {
        this.pixelRatio = Math.max(this.minPixelRatio, this.pixelRatio - 0.25);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      }
      this.sampledFrames = 0;
      this.slowFrames = 0;
    }
  }

  // Main Render Loop
    private renderLoop = (now?: number) => {
    this.animId = requestAnimationFrame(this.renderLoop);
    if (this.warming || this.disposed) return;

    const t = now ?? performance.now();
    if (this.isMobile && t - this.lastFrameTime < 9) return; // 120Hz phones: render at a steady 60
    this.lastFrameTime = t;

    this.clock.update(t);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsed();
    const dt60 = delta * 60;

    // 1. Camera orbit (same feel as the old 0.18 / 0.12 / 0.05 per-frame lerps, but frame-rate independent)
    this.orbitYaw = THREE.MathUtils.lerp(this.orbitYaw, this.targetOrbitYaw, this.damp(11.9, delta));
    this.orbitPitch = THREE.MathUtils.lerp(this.orbitPitch, this.targetOrbitPitch, this.damp(11.9, delta));
    const hr = this.orbitRadius * Math.cos(this.orbitPitch);
    this.desiredCamera.set(
      this.cameraLookAt.x + hr * Math.sin(this.orbitYaw),
      this.cameraLookAt.y + this.orbitRadius * Math.sin(this.orbitPitch),
      this.cameraLookAt.z + hr * Math.cos(this.orbitYaw),
    );
    this.camera.position.lerp(this.desiredCamera, this.damp(7.7, delta));
    this.currentLookAt.lerp(this.cameraLookAt, this.damp(3.1, delta));
    this.camera.lookAt(this.currentLookAt);

    // 2. Dust particles
    if (this.particlePositions) {
      for (let i = 1; i < this.particlePositions.length; i += 3) {
        this.particlePositions[i] += Math.sin(elapsed + i) * 0.0025 * dt60;
        if (this.particlePositions[i] > 5) this.particlePositions[i] = -0.5;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Gift bobbing
    if (this.unwrapProgress >= 1) {
      let idx = 0;
      this.giftMeshes.forEach((mesh) => {
        if (mesh.visible) {
          const base = mesh.userData.basePos as THREE.Vector3;
          mesh.position.y = base.y + Math.sin(elapsed * 2.5 + idx * 0.8) * 0.035;
          mesh.rotation.y += 0.004 * dt60;
          idx++;
        }
      });
    }

    // 4. Teddy
    if (this.teddyWalking) {
      if (this.teddyDirection === 1) {
        this.teddyGroup.position.x = THREE.MathUtils.lerp(this.teddyGroup.position.x, 3.9, this.damp(2.1, delta));
        this.teddyGroup.rotation.y = -Math.PI / 2;
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
          this.teddyGroup.rotation.y = -0.4;
        }
      } else {
        this.teddyGroup.rotation.y = Math.PI / 2;
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
      this.teddyHead.rotation.z = Math.sin(elapsed * 2) * 0.15;
      this.teddyHead.rotation.y = Math.sin(elapsed * 1.5) * 0.2 - 0.2;
      this.teddyLeftArm.rotation.z = 0.25 + Math.sin(elapsed * 3) * 0.1;
      this.teddyRightArm.rotation.z = -0.25 - Math.sin(elapsed * 3) * 0.1;
    }

    // 5. Door
    if (this.doorGroup.visible && this.isDoorOpening) {
      this.doorOpenProgress = THREE.MathUtils.lerp(this.doorOpenProgress, 1, this.damp(2.45, delta));
      this.doorHingedPanel.rotation.y = this.doorOpenProgress * (Math.PI / 2) * 0.95;
      this.doorHandle.rotation.z = Math.PI / 2 - this.doorOpenProgress * 0.5;
      this.doorLight.intensity = this.doorOpenProgress * 8.5;
    }

    // A subtle, low-cost pulse makes the proposal room feel candlelit and alive.
    if (this.roomGroup.visible) {
      const pulse = 0.5 + Math.sin(elapsed * 1.7) * 0.5;
      this.roomKeyLight.intensity = 3.35 + pulse * 0.8;
      this.roomRimLight.intensity = 2.05 + (1 - pulse) * 0.55;
      const heartScale = 3.2 + pulse * 0.075;
      this.proposalHeart.scale.set(heartScale, heartScale, 1);
      this.proposalHalo.rotation.z += delta * 0.12;
      this.proposalHeart.material.emissiveIntensity = 0.75 + pulse * 0.35;
      this.proposalHalo.material.opacity = 0.16 + pulse * 0.1;
    }

    this.renderer.render(this.scene, this.camera);
    this.sampleFrame(delta);
  };

  // ───────────── PROPOSAL ROOM ─────────────

  private tween(ms: number, fn: (p: number) => void): Promise<void> {
    return new Promise((resolve) => {
      let start = -1;
      const step = (now: number) => {
        if (this.disposed) return resolve();
        if (start < 0) start = now;
        const p = Math.min(1, (now - start) / ms);
        fn(p);
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  private pause(ms: number) {
    return this.tween(ms, () => {});
  }

  private createProposalRoom() {
    const room = this.roomGroup;
    room.position.set(ROOM_X, 0, 0);
    room.visible = false;

    // Lights live on the scene (intensity 0 until entry) so the light count never changes → no shader recompile.
    this.roomKeyLight = new THREE.PointLight(0xffc890, 0, 30, 1.6);
    this.roomKeyLight.position.set(ROOM_X, 3.2, 4);
    this.roomRimLight = new THREE.PointLight(0xff5a8a, 0, 20, 1.6);
    this.roomRimLight.position.set(ROOM_X, 1.5, -4);
    this.scene.add(this.roomKeyLight, this.roomRimLight);

    // Floor + back wall
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x2a0d1a, roughness: 0.55, metalness: 0.12 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    room.add(floor);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 16),
      new THREE.MeshStandardMaterial({ color: 0x7a2744, emissive: 0x3a0f22, roughness: 0.9 }),
    );
    wall.position.set(0, FLOOR_Y + 8, -7);
    room.add(wall);

    // Big glowing heart behind the couple (makes the silhouettes pop)
    this.proposalHeart = new THREE.Mesh(
      makeHeartGeometry(0.2),
      new THREE.MeshStandardMaterial({ color: 0xc2305c, emissive: 0xa01848, emissiveIntensity: 0.9, roughness: 0.5 }),
    );
    this.proposalHeart.scale.set(3.2, 3.2, 1);
    this.proposalHeart.position.set(0, 2.0, -6.8);
    room.add(this.proposalHeart);

    // Gold halo behind the heart: one mesh, no per-frame allocations.
    this.proposalHalo = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.028, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd77a, transparent: true, opacity: 0.22 }),
    );
    this.proposalHalo.position.set(0, 2.0, -6.9);
    room.add(this.proposalHalo);

    // String lights
    const bulbGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set((u - 0.5) * 18, 4.6 - Math.sin(u * Math.PI) * 1.1, -6.7);
      room.add(bulb);
    }

    // Red balloons lying on the floor (instanced = 2 draw calls)
    const N = this.isMobile ? 30 : 46;
    const bodies = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.32, this.isMobile ? 14 : 20, this.isMobile ? 12 : 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.08 }),
      N,
    );
    const knots = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.05, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0xb3122f, roughness: 0.4 }),
      N,
    );
    const palette = [0xd81b3c, 0xb3122f, 0xe8344f].map((c) => new THREE.Color(c));
    const d = new THREE.Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < N && guard++ < 3000) {
      const x = (Math.random() - 0.5) * 17;
      const z = -5.5 + Math.random() * 8.7;
      if (Math.abs(x) < 2.2 && z > -1.8) continue; // keep the stage clear
      const s = 0.8 + Math.random() * 0.5;
      d.rotation.set(0, Math.random() * Math.PI * 2, 0);
      d.position.set(x, FLOOR_Y + 0.368 * s, z);
      d.scale.set(s, s * 1.15, s);
      d.updateMatrix();
      bodies.setMatrixAt(placed, d.matrix);
      bodies.setColorAt(placed, palette[placed % 3]);
      d.rotation.set(Math.PI, 0, 0);
      d.position.set(x, FLOOR_Y + 0.02, z);
      d.scale.setScalar(s);
      d.updateMatrix();
      knots.setMatrixAt(placed, d.matrix);
      placed++;
    }
    bodies.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    knots.instanceMatrix.needsUpdate = true;
    bodies.frustumCulled = false;
    knots.frustumCulled = false;
    room.add(bodies, knots);

    // Characters + rose
    this.boy = this.createPerson('boy');
    this.girl = this.createPerson('girl');
    room.add(this.boy.root, this.girl.root);
    this.rose = this.createRose();
    this.rose.position.set(0, 0, 0.02);
    this.rose.visible = false;
    this.boy.handL.add(this.rose); // near-camera hand
    this.resetPeople();

    // Sparkle burst
    const SN = this.isMobile ? 180 : 320;
    const start = new Float32Array(SN * 3);
    const vel = new Float32Array(SN * 3);
    const delay = new Float32Array(SN);
    const pos = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      start[i * 3] = (Math.random() - 0.5) * 9;
      start[i * 3 + 1] = FLOOR_Y + Math.random() * 0.4;
      start[i * 3 + 2] = -0.5 + (Math.random() - 0.5) * 4;
      vel[i * 3] = (Math.random() - 0.5) * 0.9;
      vel[i * 3 + 1] = 2.2 + Math.random() * 2.6;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      delay[i] = Math.random() * 0.5;
      pos[i * 3 + 1] = -100;
    }
    this.sparkleData = { start, vel, delay };
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,224,130,0.95)');
    grd.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.sparkles = new THREE.Points(
      sgeo,
      new THREE.PointsMaterial({
        map: new THREE.CanvasTexture(c),
        size: 0.16,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.sparkles.frustumCulled = false;
    this.sparkles.visible = false;
    room.add(this.sparkles);
  }

  private createPerson(kind: 'boy' | 'girl'): Person {
    const isGirl = kind === 'girl';
    const pal = isGirl
      ? {
          skin: 0xffefd2,
          top: 0x007c83,      // PEACOCK BLUE
          bottom: 0x007c83,
          hair: 0x000000,     // BLACK
        }
      : {
          skin: 0xffefd2,
          top: 0x000000,      // BLACK
          bottom: 0x000000,   // BLACK
          hair: 0x000000,     // BLACK
        };
    const m = (color: number) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        emissive: SILHOUETTE ? 0x1c0a14 : 0x000000,
        emissiveIntensity: SILHOUETTE ? 0.6 : 0,
      });
    const skin = m(pal.skin);
    const top = m(pal.top);
    const bottom = m(pal.bottom);
    const hair = m(pal.hair);

    // Human proportions: longer legs, narrower waist, tapered limbs, soft asymmetry
    const hipY = 0.92;
    const thighLen = isGirl ? 0.42 : 0.46;
    const shinLen = isGirl ? 0.4 : 0.44;
    const thighR = isGirl ? 0.068 : 0.088;
    const shinR = isGirl ? 0.052 : 0.068;
    const upperLen = isGirl ? 0.3 : 0.32;
    const foreLen = isGirl ? 0.27 : 0.29;
    const armR0 = isGirl ? 0.048 : 0.056;

    const root = new THREE.Group();
    const lean = new THREE.Group();
    root.add(lean);

    const mkLeg = (x: number, side: 'L' | 'R') => {
      const bias = side === 'L' ? 1.02 : 0.98;
      const hip = new THREE.Group();
      hip.position.set(x, hipY, 0);

      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(thighR * bias, thighLen * 0.7, 6, 10),
        isGirl ? skin : bottom,
      );
      thigh.position.y = -thighLen * 0.5;
      // Thigh thicker at top — scale taper via non-uniform scale
      thigh.scale.set(1.08, 1, side === 'L' ? 1.02 : 0.98);
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.y = -thighLen;
      const kneecap = new THREE.Mesh(new THREE.SphereGeometry(shinR * 1.05, 10, 8), isGirl ? skin : bottom);
      knee.add(kneecap);

      const shin = new THREE.Mesh(
        new THREE.CapsuleGeometry(shinR * bias, shinLen * 0.68, 6, 10),
        isGirl ? skin : bottom,
      );
      shin.position.y = -shinLen * 0.5;
      shin.scale.set(0.95, 1, 0.95);
      knee.add(shin);

      // Ankle taper + foot with heel
      const ankle = new THREE.Mesh(new THREE.SphereGeometry(shinR * 0.85, 8, 8), isGirl ? skin : bottom);
      ankle.position.y = -shinLen;
      knee.add(ankle);
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(shinR * 1.5, shinR * 0.55, shinR * 2.6),
        isGirl ? skin : bottom,
      );
      foot.position.set(0, -shinLen - shinR * 0.1, shinR * 0.7);
      knee.add(foot);

      hip.add(knee);
      lean.add(hip);
      return { hip, knee };
    };

    const legLParts = mkLeg(isGirl ? -0.095 : -0.115, 'L');
    const legRParts = mkLeg(isGirl ? 0.1 : 0.12, 'R');

    // Pelvis / waist break so torso isn't one capsule
    const pelvis = new THREE.Mesh(
      new THREE.SphereGeometry(isGirl ? 0.14 : 0.155, 12, 10),
      bottom,
    );
    pelvis.scale.set(isGirl ? 1.25 : 1.2, 0.48, isGirl ? 0.9 : 0.82);
    pelvis.position.y = 0.95;
    lean.add(pelvis);

    const waist = new THREE.Mesh(
      new THREE.CylinderGeometry(isGirl ? 0.1 : 0.12, isGirl ? 0.13 : 0.15, 0.18, 12),
      top,
    );
    waist.position.y = 1.12;
    lean.add(waist);

    if (isGirl) {
      const chest = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), top);
      chest.scale.set(1.15, 0.7, 0.85);
      chest.position.y = 1.38;
      const dress = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.4, 0.78, 18), bottom);
      dress.position.set(0.012, 0.62, 0);
      dress.rotation.z = 0.045;
      dress.scale.set(1.04, 1, 0.9);
      lean.add(chest, dress);
    } else {
      const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.28, 6, 12), top);
      chest.scale.set(1.12, 1, 0.68);
      chest.position.y = 1.35;
      lean.add(chest);
    }

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(isGirl ? 0.055 : 0.065, isGirl ? 0.07 : 0.08, 0.14, 10),
      skin,
    );
    neck.position.y = 1.58;
    lean.add(neck);

    const head = new THREE.Group();
    head.position.y = 1.78;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(isGirl ? 0.185 : 0.195, 20, 16), skin);
    skull.scale.set(0.92, 1.08, 0.98);
    head.add(skull);
    // Soft jaw / chin so head isn't a perfect ball
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(isGirl ? 0.1 : 0.11, 12, 10), skin);
    jaw.scale.set(0.85, 0.55, 0.8);
    jaw.position.set(0, -0.12, 0.02);
    head.add(jaw);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skin);
    nose.position.set(0, -0.02, 0.185);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(isGirl ? 0.2 : 0.21, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hair,
    );
    cap.position.set(0.012, 0.025, -0.025);
    head.add(nose, cap);
    if (isGirl) {
      const long = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 6, 10), hair);
      long.position.set(0.025, -0.25, -0.11);
      long.rotation.z = 0.1;
      head.add(long);
    }
    lean.add(head);

    const mkArm = (x: number, side: 'L' | 'R') => {
      const bias = side === 'L' ? 1.03 : 0.97;
      const shoulderY = isGirl ? 1.48 : 1.52;
      const yOff = side === 'L' ? 0.018 : -0.012;
      const shoulder = new THREE.Group();
      shoulder.position.set(x, shoulderY + yOff, 0);
      // Resting hang: slight outward so arms clear the torso
      shoulder.rotation.z = side === 'L' ? 0.12 : -0.12;

      const upper = new THREE.Mesh(
        new THREE.CapsuleGeometry(armR0 * bias, upperLen * 0.62, 6, 10),
        isGirl ? skin : top,
      );
      upper.position.y = -upperLen * 0.5;
      upper.scale.set(1.05, 1, 1);
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -upperLen;
      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(armR0 * 1.05, 8, 8), isGirl ? skin : top);
      elbow.add(elbowJoint);

      const fore = new THREE.Mesh(
        new THREE.CapsuleGeometry(armR0 * 0.85 * bias, foreLen * 0.62, 6, 10),
        isGirl ? skin : top,
      );
      fore.position.y = -foreLen * 0.5;
      elbow.add(fore);

      const hand = new THREE.Group();
      hand.position.y = -foreLen;
      const palm = new THREE.Mesh(new THREE.SphereGeometry(armR0 * 1.1, 8, 8), skin);
      palm.scale.set(0.9, 0.7, 1.25);
      hand.add(palm);
      elbow.add(hand);

      // Natural slight elbow bend at rest
      elbow.rotation.x = 0.28;

      shoulder.add(elbow);
      lean.add(shoulder);
      return { shoulder, elbow, hand };
    };

    const armSpan = isGirl ? 0.24 : 0.3;
    const armLParts = mkArm(-armSpan, 'L');
    const armRParts = mkArm(armSpan * 1.03, 'R');

    // Face each other in profile. Local +Z = toward partner.
    root.rotation.y = isGirl ? -Math.PI / 2 : Math.PI / 2;
    if (isGirl) root.scale.setScalar(0.92);

    return {
      root,
      lean,
      legL: legLParts.hip,
      legR: legRParts.hip,
      kneeL: legLParts.knee,
      kneeR: legRParts.knee,
      armL: armLParts.shoulder,
      armR: armRParts.shoulder,
      elbowL: armLParts.elbow,
      elbowR: armRParts.elbow,
      handL: armLParts.hand,
      handR: armRParts.hand,
      head,
    };
  }

  private createRose(): THREE.Group {
    // Stem along local +Y. World upright is maintained via keepRoseUpright().
    const g = new THREE.Group();
    const std = (color: number, emissive = 0x000000, ei = 0) =>
      new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.5, side: THREE.DoubleSide });
    const stemMat = std(0x3f7d4a);
    const leafMat = std(0x5fa06a);
    const outerMat = std(0xe8383d, 0x3a0508, 0.3);
    const midMat = std(0xcc2a30, 0x300408, 0.3);
    const innerMat = std(0xa81a24, 0x2a0306, 0.3);
    const coreMat = std(0x7a0f1a, 0x200205, 0.3);
    const petalLine = new THREE.LineBasicMaterial({ color: 0x2a0508 });
    const leafLine = new THREE.LineBasicMaterial({ color: 0x1f3d25 });

    // Stem + thorns
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.013, 0.5, 8), stemMat);
    stem.position.y = 0.25;
    g.add(stem);
    const thornGeo = new THREE.ConeGeometry(0.01, 0.035, 6);
    ([[0.1, 1], [0.2, -1], [0.3, 1], [0.38, -1]] as number[][]).forEach(([y, s]) => {
      const t = new THREE.Mesh(thornGeo, stemMat);
      t.position.set(0.016 * s, y, 0);
      t.rotation.z = (-s * Math.PI) / 2;
      g.add(t);
    });

    // Leaves + sepals (pointed leaf shape with dark outline)
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.55, 0.2, 0.5, 0.75, 0, 1);
    leafShape.bezierCurveTo(-0.5, 0.75, -0.55, 0.2, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 10);
    const leafEdges = new THREE.EdgesGeometry(leafGeo);
    const addLeaf = (y: number, yaw: number, len: number, tilt: number, wid = 0.9) => {
      const pivot = new THREE.Group();
      pivot.position.y = y;
      pivot.rotation.y = yaw;
      const holder = new THREE.Group();
      holder.scale.set(len * wid, len, 1);
      holder.rotation.z = -tilt;
      holder.add(new THREE.Mesh(leafGeo, leafMat), new THREE.LineSegments(leafEdges, leafLine));
      pivot.add(holder);
      g.add(pivot);
    };
    addLeaf(0.12, 0.3, 0.17, 0.95);
    addLeaf(0.12, 1.2, 0.13, 1.15);
    addLeaf(0.28, 0.3 + Math.PI, 0.17, 0.95);
    addLeaf(0.28, 0.3 + Math.PI - 0.9, 0.13, 1.15);
    for (let i = 0; i < 5; i++) addLeaf(0.47, (i / 5) * Math.PI * 2, 0.075, 2.4, 0.3); // sepals

    // Bloom: big flared outer petals → cupped inner spiral
    const bloom = new THREE.Group();
    bloom.position.y = 0.5;
    const layers = [
      { n: 5, r: 0.03,  y: 0.0,   w: 0.1,   h: 0.095, tilt: 1.05, cup: 0.35, curl: 0.35, m: outerMat, off: 0 },
      { n: 5, r: 0.022, y: 0.015, w: 0.088, h: 0.085, tilt: 0.7,  cup: 0.5,  curl: 0.18, m: midMat,   off: 0.6 },
      { n: 4, r: 0.015, y: 0.03,  w: 0.07,  h: 0.07, tilt: 0.38, cup: 0.7,  curl: 0.0,  m: innerMat, off: 0.3 },
      { n: 3, r: 0.008, y: 0.042, w: 0.05,  h: 0.055, tilt: 0.12, cup: 0.9,  curl: -0.1, m: coreMat,  off: 0.9 },
    ];
    for (const L of layers) {
      const geo = makePetalGeometry(L.w, L.h, L.cup, L.curl);
      const edges = new THREE.EdgesGeometry(geo, 30); // dark border lines like the illustration
      for (let i = 0; i < L.n; i++) {
        const pivot = new THREE.Group();
        pivot.position.y = L.y;
        pivot.rotation.y = L.off + (i / L.n) * Math.PI * 2;
        const holder = new THREE.Group();
        holder.position.z = L.r;
        holder.rotation.x = L.tilt;
        holder.add(new THREE.Mesh(geo, L.m), new THREE.LineSegments(edges, petalLine));
        pivot.add(holder);
        bloom.add(pivot);
      }
    }
    const bud = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), coreMat);
    bud.position.y = 0.04;
    bud.scale.set(1, 1.2, 1);
    bloom.add(bud);
    g.add(bloom);

    const wrap = new THREE.Group();
    wrap.add(g);
    wrap.scale.setScalar(1.15);
    return wrap;
  }

  /** Keep the rose stem world-vertical (90° upright) regardless of hand pose. */
  private keepRoseUpright() {
    if (!this.rose?.visible || !this.rose.parent) return;
    this.rose.parent.updateWorldMatrix(true, false);
    this.rose.parent.getWorldQuaternion(this.tmpQ);
    this.rose.quaternion.copy(this.tmpQ.invert());
    const towardHer = THREE.MathUtils.degToRad(22);
    this.rose.rotateZ(-towardHer);
  }

  private restArms(p: Person) {
    p.armL.rotation.set(0, 0, 0.12);
    p.armR.rotation.set(0, 0, -0.12);
    p.elbowL.rotation.set(0.28, 0, 0);
    p.elbowR.rotation.set(0.28, 0, 0);
  }

  private resetPersonPose(p: Person, x: number, z = 0) {
    p.root.position.set(x, FLOOR_Y, z);
    p.lean.position.set(0, 0, 0);
    p.lean.rotation.set(0, 0, 0);
    [p.legL, p.legR, p.kneeL, p.kneeR, p.head].forEach((o) => o.rotation.set(0, 0, 0));
    this.restArms(p);
  }

  private resetPeople() {
    const startX = this.isMobile ? 3.8 : 6.2;
    // Slight Z offset so silhouettes don't occupy the exact same plane (helps the kiss)
    this.resetPersonPose(this.boy, -startX, 0.05);
    this.resetPersonPose(this.girl, startX, -0.05);
    // Near hand tucked behind his back (rose hidden)
    this.boy.armL.rotation.x = 0.45;
    this.boy.elbowL.rotation.x = 0.4;
    this.rose.visible = false;
  }

  /** Call after setState('PROPOSAL_ENTER') while the screen is black. */
  public enterProposalRoom() {
    this.roomGroup.visible = true;
    this.roomKeyLight.intensity = 22;
    this.roomRimLight.intensity = 16;
    this.resetPeople();
    // snap the camera (don't sweep 80 units across the world)
    this.camera.position.copy(this.cameraTargetPos);
    this.currentLookAt.copy(this.cameraLookAt);
  }

  public async playProposalWalkIn() {
    const { boy, girl } = this;
    const startX = this.isMobile ? 3.8 : 6.2;
    const stopX = 0.72;
    const dur = 6800;
    await this.tween(dur, (p) => {
      const e = easeOut(p);
      boy.root.position.x = lerp(-startX, -stopX, e);
      girl.root.position.x = lerp(startX, stopX, e);
      const t = (p * dur) / 1000;
      const fade = Math.min(1, (1 - p) * 4);
      const amp = 0.38 * fade;
      // Slower gait; forward = negative Rx
      const pb = t * 6.4;
      const pg = t * 6.4 + 0.9;
      const thighB = Math.sin(pb) * amp;
      const thighG = Math.sin(pg) * amp;
      boy.legL.rotation.x = -thighB;
      boy.legR.rotation.x = thighB;
      boy.kneeL.rotation.x = Math.max(0, -Math.sin(pb)) * 0.8 * fade + 0.06 * fade;
      boy.kneeR.rotation.x = Math.max(0, Math.sin(pb)) * 0.8 * fade + 0.06 * fade;

      girl.legL.rotation.x = -thighG;
      girl.legR.rotation.x = thighG;
      girl.kneeL.rotation.x = Math.max(0, -Math.sin(pg)) * 0.8 * fade + 0.06 * fade;
      girl.kneeR.rotation.x = Math.max(0, Math.sin(pg)) * 0.8 * fade + 0.06 * fade;

      // Pendulum arm swing — hang down, swing forward/back (never raised high)
      const armAmp = 0.4 * fade;
      boy.armR.rotation.x = Math.sin(pb) * armAmp;
      boy.armR.rotation.z = -0.12;
      boy.elbowR.rotation.x = 0.35 + Math.max(0, -Math.sin(pb)) * 0.25;
      // Near arm still mostly down/back (hiding rose) with a small pendulum
      boy.armL.rotation.x = 0.35 + Math.sin(pb) * 0.12 * fade;
      boy.armL.rotation.z = 0.12;
      boy.elbowL.rotation.x = 0.4;

      girl.armL.rotation.x = -Math.sin(pg) * armAmp;
      girl.armL.rotation.z = 0.12;
      girl.armR.rotation.x = Math.sin(pg) * armAmp;
      girl.armR.rotation.z = -0.12;
      girl.elbowL.rotation.x = 0.32 + Math.max(0, Math.sin(pg)) * 0.22;
      girl.elbowR.rotation.x = 0.32 + Math.max(0, -Math.sin(pg)) * 0.22;

      boy.lean.rotation.z = Math.sin(pb) * 0.035 * fade;
      girl.lean.rotation.z = Math.sin(pg) * 0.04 * fade;
      boy.lean.rotation.y = Math.sin(pb) * 0.025 * fade;
      girl.lean.rotation.y = Math.sin(pg) * 0.025 * fade;

      boy.root.position.y = FLOOR_Y + Math.max(0, Math.sin(pb * 2)) * 0.028 * fade;
      girl.root.position.y = FLOOR_Y + Math.max(0, Math.sin(pg * 2)) * 0.028 * fade;
    });
    [boy, girl].forEach((p) => {
      [p.legL, p.legR, p.kneeL, p.kneeR].forEach((o) => o.rotation.set(0, 0, 0));
      p.lean.rotation.set(0, 0, 0);
      p.root.position.y = FLOOR_Y;
      this.restArms(p);
    });
    boy.armL.rotation.x = 0.45;
    boy.elbowL.rotation.x = 0.4;
  }

  /** He pulls out the rose, she gasps, he drops to one knee. */
  public async playRoseAndKneel() {
    const { boy, girl } = this;
    await this.pause(900);
    this.rose.visible = true;
    this.keepRoseUpright();
    // Offer rose upright + her asymmetric hands-to-face gasp
    await this.tween(1400, (p) => {
      const e = easeInOut(p);
      // Arm forward/up enough to present; rose forced vertical each frame
      boy.armL.rotation.x = lerp(0.45, -1.05, e);
      boy.armL.rotation.z = lerp(0.12, 0.05, e);
      boy.elbowL.rotation.x = lerp(0.4, 0.15, e);
      boy.armR.rotation.x = lerp(0, -0.25, e);
      boy.elbowR.rotation.x = lerp(0.28, 0.35, e);

      girl.head.rotation.x = lerp(0, 0.08, e);
      girl.head.rotation.z = lerp(0, -0.06, e);
      this.keepRoseUpright();
    });
    await this.pause(600);
    // Classic proposal kneel
    await this.tween(1800, (p) => {
      const e = easeInOut(p);
      boy.lean.position.y = lerp(0, -0.48, e);
      boy.lean.rotation.x = lerp(0, 0.12, e);
      boy.legL.rotation.x = lerp(0, -1.45, e);
      boy.kneeL.rotation.x = lerp(0, 1.5, e);
      boy.legR.rotation.x = lerp(0, 0.12, e);
      boy.kneeR.rotation.x = lerp(0, 1.65, e);
      boy.head.rotation.x = lerp(0, -0.28, e);
      boy.head.rotation.z = lerp(0, 0.04, e);
      // Keep offering arm steady while he sinks
      boy.armL.rotation.x = -1.12;
      boy.elbowL.rotation.x = 0.15;
      this.keepRoseUpright();
    });
    await this.pause(800);
  }

  /** Sparkles fly bottom → top. */
  public async burstSparkles() {
    const { start, vel, delay } = this.sparkleData;
    const attr = this.sparkles.geometry.attributes.position as THREE.BufferAttribute;
    const mat = this.sparkles.material as THREE.PointsMaterial;
    const total = 3600;
    this.sparkles.visible = true;
    mat.opacity = 1;
    await this.tween(total, (p) => {
      const t = (p * total) / 1000;
      for (let i = 0; i < delay.length; i++) {
        const lt = t - delay[i];
        if (lt < 0) {
          attr.setXYZ(i, 0, -100, 0);
          continue;
        }
        attr.setXYZ(
          i,
          start[i * 3] + vel[i * 3] * lt,
          start[i * 3 + 1] + vel[i * 3 + 1] * lt - 0.25 * lt * lt,
          start[i * 3 + 2] + vel[i * 3 + 2] * lt,
        );
      }
      attr.needsUpdate = true;
      mat.opacity = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
    });
    this.sparkles.visible = false;
  }

  /** She says yes: she takes the rose from his hand. */
  public async playAcceptRose() {
    const { boy, girl, rose } = this;
    await this.pause(500);
    await this.tween(1300, (p) => {
      const e = easeInOut(p);
      girl.armR.rotation.x = lerp(0, -0.9, e);
      girl.elbowR.rotation.x = lerp(0.28, 0.5, e);
      girl.head.rotation.x = lerp(0.08, 0, e);
      girl.head.rotation.z = lerp(-0.06, 0, e);
      this.keepRoseUpright();
    });
    girl.handR.attach(rose);
    const p0 = rose.position.clone();
    await this.tween(900, (p) => {
      const e = easeInOut(p);
      rose.position.set(lerp(p0.x, 0, e), lerp(p0.y, 0, e), lerp(p0.z, 0, e));
      boy.armL.rotation.x = lerp(-0.85, -0.15, e);
      boy.elbowL.rotation.x = lerp(0.25, 0.3, e);
      girl.armR.rotation.x = lerp(-0.9, -0.55, e);
      this.keepRoseUpright();
    });
    await this.pause(700);
  }

  /** He stands up, they step close and kiss. Hearts float up. */
  public async playKiss() {
    const { boy, girl } = this;

    type ArmPose = { aL: number; zL: number; eL: number; aR: number; zR: number; eR: number };
    const setArms = (p: Person, a: ArmPose, b: ArmPose, e: number) => {
      p.armL.rotation.x = lerp(a.aL, b.aL, e);
      p.armL.rotation.z = lerp(a.zL, b.zL, e);
      p.elbowL.rotation.x = lerp(a.eL, b.eL, e);
      p.armR.rotation.x = lerp(a.aR, b.aR, e);
      p.armR.rotation.z = lerp(a.zR, b.zR, e);
      p.elbowR.rotation.x = lerp(a.eR, b.eR, e);
    };
    // Poses at the end of playAcceptRose → arms opening → arms wrapped around the partner
    const boyStart: ArmPose = { aL: -0.15, zL: 0.12, eL: 0.3, aR: -0.25, zR: -0.12, eR: 0.35 };
    const girlStart: ArmPose = { aL: 0, zL: 0.12, eL: 0.28, aR: -0.55, zR: -0.12, eR: 0.5 };
    const open: ArmPose = { aL: -0.5, zL: 0.3, eL: -0.4, aR: -0.5, zR: -0.3, eR: -0.4 };
    const boyHug: ArmPose = { aL: -0.95, zL: 0.6, eL: -0.9, aR: -0.85, zR: -0.55, eR: -0.9 };
    const girlHug: ArmPose = { aL: -0.95, zL: 0.6, eL: -0.9, aR: -0.75, zR: -0.5, eR: -0.6 }; // rose hand a bit lower

    // 1. Stand up from the kneel (stays where he knelt)
    await this.tween(1600, (p) => {
      const e = easeInOut(p);
      boy.lean.position.y = lerp(-0.48, 0, e);
      boy.lean.rotation.x = lerp(0.12, 0, e);
      boy.legL.rotation.x = lerp(-1.45, 0, e);
      boy.kneeL.rotation.x = lerp(1.5, 0, e);
      boy.legR.rotation.x = lerp(0.12, 0, e);
      boy.kneeR.rotation.x = lerp(1.65, 0, e);
      boy.head.rotation.x = lerp(-0.28, 0, e);
      boy.head.rotation.z = lerp(0.04, 0, e);
      this.keepRoseUpright();
    });
    await this.pause(400);

    // 2. One step each toward the other, arms opening
    await this.tween(1500, (p) => {
      const e = easeInOut(p);
      boy.root.position.x = lerp(-0.72, -0.2, e);
      girl.root.position.x = lerp(0.72, 0.2, e);
      const a = Math.sin(Math.min(1, p * 2) * Math.PI);        // first half: one leg steps
      const b = p > 0.5 ? Math.sin((p - 0.5) * 2 * Math.PI) : 0; // second half: other leg follows
      boy.legL.rotation.x = -a * 0.5;
      boy.kneeL.rotation.x = a * 0.6;
      boy.legR.rotation.x = -b * 0.5;
      boy.kneeR.rotation.x = b * 0.6;
      girl.legR.rotation.x = -a * 0.45;
      girl.kneeR.rotation.x = a * 0.55;
      girl.legL.rotation.x = -b * 0.45;
      girl.kneeL.rotation.x = b * 0.55;
      setArms(boy, boyStart, open, e);
      setArms(girl, girlStart, open, e);
      this.keepRoseUpright();
    });

    // 3. Both wrap their arms around each other, lean in and kiss
    this.floatHearts();
    await this.tween(2000, (p) => {
      const e = easeInOut(p);
      setArms(boy, open, boyHug, e);
      setArms(girl, open, girlHug, e);
      boy.lean.rotation.x = lerp(0, 0.06, e);
      girl.lean.rotation.x = lerp(0, 0.03, e);
      girl.root.position.y = FLOOR_Y + 0.04 * e; // tiny tiptoe to reach him
      boy.head.rotation.x = lerp(0, 0.2, e);
      boy.head.rotation.z = lerp(0, 0.06, e);
      girl.head.rotation.x = lerp(0, -0.14, e);
      girl.head.rotation.z = lerp(0, -0.06, e);
      this.keepRoseUpright();
    });
    await this.pause(2800);
  }

  private floatHearts() {
    const geo = makeHeartGeometry(0.05);
    const items = Array.from({ length: 9 }, (_, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff5c8a : 0xff2e63, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      const s = 0.09 + Math.random() * 0.08;
      mesh.scale.set(s, s, s);
      const x0 = (Math.random() - 0.5) * 0.9;
      const y0 = 0.4 + Math.random() * 0.4;
      mesh.position.set(x0, y0, 0.3 + Math.random() * 0.3);
      this.roomGroup.add(mesh);
      return { mesh, mat, x0, y0, delay: Math.random() * 0.5, speed: 0.5 + Math.random() * 0.4, sway: Math.random() * 6 };
    });
    void this.tween(3200, (p) => {
      const t = p * 3.2;
      items.forEach((it) => {
        const lt = Math.max(0, t - it.delay);
        it.mesh.position.y = it.y0 + lt * it.speed;
        it.mesh.position.x = it.x0 + Math.sin(lt * 2 + it.sway) * 0.12;
        it.mat.opacity = lt <= 0 ? 0 : Math.min(1, lt * 3) * Math.max(0, 1 - lt / 2.4);
      });
    }).then(() => {
      items.forEach((it) => {
        this.roomGroup.remove(it.mesh);
        it.mat.dispose();
      });
      geo.dispose();
    });
  }

  /** Screen-space position above a character's head, for the HTML chat bubbles. */
  public getHeadScreenPosition(who: 'boy' | 'girl') {
    const p = who === 'boy' ? this.boy : this.girl;
    if (!p) return null;
    p.head.getWorldPosition(this.tmpV);
    this.tmpV.y += 0.4;
    this.tmpV.project(this.camera);
    if (this.tmpV.z > 1) return null;
    return {
      x: (this.tmpV.x * 0.5 + 0.5) * this.container.clientWidth,
      y: (-this.tmpV.y * 0.5 + 0.5) * this.container.clientHeight,
    };
  }

  public destroy() {
    this.disposed = true;
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    if (this.resizeRaf !== null) cancelAnimationFrame(this.resizeRaf);
    window.removeEventListener('resize', this.onResize);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerup', this.onPointerUp);
    this.container.removeEventListener('pointercancel', this.onPointerCancel);
    this.clock.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.parentNode?.removeChild(this.renderer.domElement);
  }
}
