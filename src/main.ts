import {
	Color,
	InstancedMesh,
	Matrix4,
	MeshBasicMaterial,
	PerspectiveCamera,
	Scene,
	SphereGeometry,
	WebGLRenderer,
} from "three";

class Waves {
	private scene: Scene;
	private camera: PerspectiveCamera;
	private renderer: WebGLRenderer;
	private mesh!: InstancedMesh;
	private count = 0;
	private container: HTMLElement;

	private windowHalfX = window.innerWidth / 2;
	private windowHalfY = window.innerHeight / 2;

	// Colors
	private blueMaterial = 0x5bc2e7;
	private blueBackground = 0x111111;

	// Particle properties
	private particleSpacing = 120;
	private particleSize = 40;
	private amountX = 200;
	private amountY = 100;
	private total = this.amountX * this.amountY;
	private speed = 0.04;
	private animationId = 0;

	// Lift effect properties for mouse/touch press
	private liftAmount = 0;
	private liftMax = 150;
	private liftSpeed = 1.5;
	private liftDecay = 0.99;

	// Mouse tracking states
	private isMouseDown = false;
	private mouseX = 0;
	private mouseY = 0;

	// Touch tracking states
	private isTouching = false;
	private lastTouchX = 0;
	private lastTouchY = 0;

	// Pre-calculate base positions and reuse objects
	private basePositions: { x: number; z: number }[] = [];
	private matrix = new Matrix4();
	private color = new Color();

	constructor(container: HTMLElement) {
		this.container = container;
		this.scene = new Scene();
		this.camera = new PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			1,
			10000,
		);
		this.renderer = new WebGLRenderer({
			alpha: true,
			antialias: true,
			// Request high-performance GPU
			powerPreference: "high-performance",
		});
		this.init(container);
	}

	private init(container: HTMLElement): void {
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setClearColor(this.blueBackground, 1);
		container.appendChild(this.renderer.domElement);

		this.camera.position.z = 10000;

		this.preCalculatePositions();
		this.createInstancedParticles();
		this.setupEventListeners();
		this.animate();
	}

	private preCalculatePositions(): void {
		// Pre-calculate base positions to avoid repeated calculations
		for (let ix = 0; ix < this.amountX; ix++) {
			for (let iy = 0; iy < this.amountY; iy++) {
				this.basePositions.push({
					x:
						ix * this.particleSpacing -
						(this.amountX * this.particleSpacing) / 2,
					z:
						iy * this.particleSpacing -
						(this.amountY * this.particleSpacing) / 2,
				});
			}
		}
	}

	private createInstancedParticles(): void {
		// Use InstancedMesh for massive performance improvement
		const geometry = new SphereGeometry(this.particleSize, 8, 6);
		const material = new MeshBasicMaterial({
			color: this.blueMaterial,
			opacity: 0.8,
			transparent: true,
		});

		this.mesh = new InstancedMesh(geometry, material, this.total);
		this.scene.add(this.mesh);

		this.updateInstances();
	}

	private updateInstances(): void {
		let particleIndex = 0;

		// Progressive lift logic
		if (this.isMouseDown || this.isTouching) {
			this.liftAmount = Math.min(
				this.liftMax,
				this.liftAmount + this.liftSpeed,
			);
		} else {
			this.liftAmount = Math.max(0, this.liftAmount * this.liftDecay);
		}

		for (let ix = 0; ix < this.amountX; ix++) {
			for (let iy = 0; iy < this.amountY; iy++) {
				const basePos = this.basePositions[particleIndex];

				// Wave animation accouting for lift activation
				const wave =
					Math.sin((ix + this.count) * 0.3) * 50 +
					Math.sin((iy + this.count) * 0.5) * 50 +
					this.liftAmount;

				// Scale animation
				const scale =
					(Math.sin((ix + this.count) * 0.3) + 1) * 4 +
					(Math.sin((iy + this.count) * 0.5) + 1) * 4;

				const finalScale = scale * 0.01;

				// Set matrix for this instance
				this.matrix.makeScale(finalScale, finalScale, finalScale);
				this.matrix.setPosition(basePos.x, wave, basePos.z);
				this.mesh.setMatrixAt(particleIndex, this.matrix);

				// Color variation based on wave (optional - adds some overhead)
				const intensity = (scale / 16) * 0.5 + 0.5;
				this.color.setRGB(
					(((this.blueMaterial >> 16) & 255) / 255) * intensity,
					(((this.blueMaterial >> 8) & 255) / 255) * intensity,
					((this.blueMaterial & 255) / 255) * intensity,
				);
				this.mesh.setColorAt(particleIndex, this.color);

				particleIndex++;
			}
		}

		this.mesh.instanceMatrix.needsUpdate = true;
		if (this.mesh.instanceColor) {
			this.mesh.instanceColor.needsUpdate = true;
		}
	}

	private isEventOnContainer(event: MouseEvent | TouchEvent): boolean {
		const rect = this.container.getBoundingClientRect();
		let clientX: number;
		let clientY: number;

		if (event instanceof MouseEvent) {
			clientX = event.clientX;
			clientY = event.clientY;
		} else if (event instanceof TouchEvent && event.touches.length > 0) {
			clientX = event.touches[0].clientX;
			clientY = event.touches[0].clientY;
		} else {
			return false;
		}

		return (
			clientX >= rect.left &&
			clientX <= rect.right &&
			clientY >= rect.top &&
			clientY <= rect.bottom
		);
	}

	private setupEventListeners(): void {
		// Mouse events
		window.addEventListener(
			"mousedown",
			(event) => {
				if (!this.isEventOnContainer(event)) {
					return;
				}
				this.isMouseDown = true;
			},
			{ passive: true },
		);

		window.addEventListener(
			"mousemove",
			(event) => {
				if (!this.isEventOnContainer(event)) {
					return;
				}
				this.mouseX = event.clientX - this.windowHalfX;
				this.mouseY = event.clientY - this.windowHalfY;
			},
			{ passive: true },
		);

		window.addEventListener(
			"mouseup",
			() => {
				this.isMouseDown = false;
			},
			{ passive: true },
		);

		// Touch events
		window.addEventListener(
			"touchstart",
			(event) => {
				if (!this.isEventOnContainer(event)) {
					return;
				}
				this.isTouching = true;
				const touch = event.touches[0];
				this.lastTouchX = touch.clientX;
				this.lastTouchY = touch.clientY;
			},
			{ passive: true },
		);

		window.addEventListener(
			"touchmove",
			(event) => {
				if (!this.isEventOnContainer(event)) {
					return;
				}
				if (this.isTouching && event.touches.length > 0) {
					const touch = event.touches[0];
					const currentX = touch.clientX;
					const currentY = touch.clientY;

					const deltaX = currentX - this.lastTouchX;
					const deltaY = currentY - this.lastTouchY;
					this.mouseX += deltaX * 2;
					this.mouseY += deltaY * 2;

					const maxX = this.windowHalfX * 2;
					const maxY = this.windowHalfY * 2;
					this.mouseX = Math.max(-maxX, Math.min(maxX, this.mouseX));
					this.mouseY = Math.max(-maxY, Math.min(maxY, this.mouseY));

					this.lastTouchX = currentX;
					this.lastTouchY = currentY;
				}
			},
			{ passive: true },
		);

		window.addEventListener(
			"touchend",
			() => {
				this.isTouching = false;
			},
			{ passive: true },
		);

		window.addEventListener(
			"touchcancel",
			(event) => {
				if (!this.isEventOnContainer(event)) {
					return;
				}
				this.isTouching = false;
			},
			{ passive: true },
		);

		window.addEventListener("resize", () => this.onWindowResize(), {
			passive: true,
		});
	}

	private onWindowResize(): void {
		this.windowHalfX = window.innerWidth / 2;
		this.windowHalfY = window.innerHeight / 2;

		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(window.innerWidth, window.innerHeight);
	}

	private animate(): void {
		this.animationId = requestAnimationFrame(() => this.animate());
		this.render();
	}

	private render(): void {
		// Camera follows mouse/touch with some influence
		this.camera.position.x += (this.mouseX - this.camera.position.x) * 0.05;
		this.camera.position.y += (-this.mouseY - this.camera.position.y) * 0.05;

		this.camera.position.set(
			this.camera.position.x,
			355 + this.camera.position.y * 0.1,
			1000,
		);

		// Update all position transforms
		this.updateInstances();

		this.renderer.render(this.scene, this.camera);
		this.count += this.speed;
	}

	public destroy(): void {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
		}
		this.renderer.dispose();
	}
}

const renderContainer = document.querySelector("#render") as HTMLElement;
new Waves(renderContainer);

const emailLink = document.querySelector("#email") as HTMLAnchorElement;
emailLink.onclick = () => {
	navigator.clipboard.writeText(emailLink.href.replace("mailto:", ""));
};
