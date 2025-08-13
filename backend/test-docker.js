const Docker = require("dockerode");

async function testDocker() {
  const docker = new Docker();

  try {
    console.log("Testing Docker connection...");
    const info = await docker.info();
    console.log("✅ Docker is connected");
    console.log("Docker version:", info.ServerVersion);

    console.log("\nTesting Node.js container...");
    const container = await docker.createContainer({
      Image: "node:16-slim",
      Cmd: ["node", "-e", 'console.log("Hello from Docker!")'],
      AttachStdout: true,
      AttachStderr: true,
    });

    await container.start();
    const result = await container.wait();
    const logs = await container.logs({ stdout: true, stderr: true });

    console.log("Container output:", logs.toString());
    console.log("Exit code:", result.StatusCode);

    await container.remove();
    console.log("✅ Node.js container test successful");
  } catch (error) {
    console.error("❌ Docker test failed:", error.message);
    console.error("Full error:", error);
  }
}

testDocker();
