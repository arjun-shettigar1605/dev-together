const Docker = require("dockerode");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const docker = new Docker();

const languageConfig = {
  //config for all languages
  javascript: {
    image: "node:18-alpine",
    command: (filename) => ["node", filename],
    extension: ".js",
  },
  sqlite: {
    image: "alpine:latest",
    command: (filename) => [
      "sh",
      "-c",
      `apk add --no-cache sqlite && sqlite3 mydatabase.db < init.sql && sqlite3 -json mydatabase.db < ${filename} || sqlite3 -header -column mydatabase.db < ${filename}`,
    ],

    extension: ".sql",
    // This initFile content will be written to init.sql
    initFile: `
      DROP TABLE IF EXISTS Customers;
      CREATE TABLE Customers (
        customer_id INT PRIMARY KEY, 
        first_name VARCHAR(100), 
        last_name VARCHAR(100), 
        age INT, 
        country VARCHAR(100)
      );
      INSERT INTO Customers (customer_id, first_name, last_name, age, country) VALUES 
      (1, 'John', 'Doe', 31, 'USA'), 
      (2, 'Robert', 'Luna', 22, 'USA'), 
      (3, 'David', 'Robinson', 22, 'UK'), 
      (4, 'John', 'Reinhardt', 25, 'UK'), 
      (5, 'Betty', 'Doe', 28, 'USA');
      
      DROP TABLE IF EXISTS Orders;
      CREATE TABLE Orders (
        order_id INT PRIMARY KEY, 
        item VARCHAR(100), 
        amount INT, 
        customer_id INT,
        FOREIGN KEY(customer_id) REFERENCES Customers(customer_id)
      );
      INSERT INTO Orders (order_id, item, amount, customer_id) VALUES 
      (1, 'Keyboard', 100, 1), 
      (2, 'Mouse', 150, 1), 
      (3, 'Monitor', 80, 2), 
      (4, 'Keyboard', 100, 3);
      
      DROP TABLE IF EXISTS Shippings;
      CREATE TABLE Shippings (
        shipping_id INT PRIMARY KEY, 
        status VARCHAR(100), 
        customer_id INT,
        FOREIGN KEY(customer_id) REFERENCES Customers(customer_id)
      );
      INSERT INTO Shippings (shipping_id, status, customer_id) VALUES 
      (1, 'Pending', 1),
      (2, 'Delivered', 2),
      (3, 'Delivered', 3);
    `,
  },
  python: {
    image: "python:3.9-slim",
    command: (filename) => ["python", "-u", filename],
    extension: ".py",
  },
  java: {
    image: "openjdk:11",
    command: (filename) => [
      "sh",
      "-c",
      `javac ${filename} && java ${filename.slice(0, -5)}`,
    ],
    extension: ".java",
  },
  cpp: {
    image: "gcc:latest",
    command: (filename) => ["sh", "-c", `g++ ${filename} -o a.out && ./a.out`],
    extension: ".cpp",
  },
  c: {
    image: "gcc:latest",
    command: (filename) => ["sh", "-c", `gcc ${filename} -o a.out && ./a.out`],
    extension: ".c",
  },
  ruby: {
    image: "ruby:3-slim",
    command: (filename) => ["ruby", filename],
    extension: ".rb",
  },
  dart: {
    image: "dart:latest",
    command: (filename) => ["dart", "run", filename],
    extension: ".dart",
  },
  go: {
    image: "golang:1.20-alpine",
    command: (filename) => ["go", "run", filename],
    extension: ".go",
  },
  php: {
    image: "php:8-cli-alpine",
    command: (filename) => ["php", filename],
    extension: ".php",
  },
  rust: {
    image: "rust:1-slim",
    command: (filename) => [
      "sh",
      "-c",
      `rustc ${filename} -o a.out && ./a.out`,
    ],
    extension: ".rs",
  },
  swift: {
    image: "swift:5.8-slim",
    command: (filename) => [
      "sh",
      "-c",
      `swiftc ${filename} -o a.out && ./a.out`,
    ],
    extension: ".swift",
  },
  typescript: {
    image: "ghcr.io/nodejs/ts-node:18", // Image with ts-node pre-installed
    command: (filename) => ["ts-node", filename],
    extension: ".ts",
  },
};

const runCodeInContainer = async (language, code) => {
  console.log(`Executing ${language} code:`, code.substring(0, 100) + "...");
  const effectiveLanguage = language === "sql" ? "sqlite" : language;

  const config = languageConfig[effectiveLanguage];
  if (!config) {
    throw new Error(`Language '${language}' is not supported.`);
  }

  // Create a temporary directory to store the code file
  const tempDir = path.join(__dirname, "temp", uuid());
  console.log(`Creating temp directory: ${tempDir}`);

  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create temp directory:", err);
    throw new Error("Failed to create temporary directory");
  }

  // For Java, the filename must match the public class name
  const filename =
    language === "java" ? "Main.java" : `script${config.extension}`;
  const filepath = path.join(tempDir, filename);

  try {
    fs.writeFileSync(filepath, code);
    console.log(`Code written to: ${filepath}`);
    if (config.initFile) {
      const initFilePath = path.join(tempDir, "init.sql");
      fs.writeFileSync(initFilePath, config.initFile);
      console.log(`Init script written to: ${initFilePath}`);
    }
  } catch (err) {
    console.error("Failed to write code file:", err);
    throw new Error("Failed to write code file");
  }

  let container;
  try {
    console.log(`Pulling/checking image: ${config.image}`);
    await pullImage(config.image);

    console.log("Creating container...");
    container = await docker.createContainer({
      Image: config.image,
      Cmd: config.command(filename),
      WorkingDir: "/usr/src/app",
      HostConfig: {
        Binds: [`${tempDir}:/usr/src/app`],
        Memory: 256 * 1024 * 1024, // 256MB Memory limit
        CpuShares: 512, // Relative CPU weight (~0.5 core)
        NetworkMode: "none",
        AutoRemove: false, // We'll remove manually
      },
      Tty: false,
      AttachStdout: true,
      AttachStderr: true,
      OpenStdin: false,
      StdinOnce: false,
    });

    console.log("Starting container...");
    await container.start();

    // Promise to wait for the container to finish
    const executionPromise = container.wait();

    // Promise to handle timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Execution timed out after 10 seconds."));
      }, 10000);
    });

    // Wait for either the container to finish or the timeout
    console.log("Waiting for execution to complete...");
    const result = await Promise.race([executionPromise, timeoutPromise]);

    console.log("Getting logs...");
    const stdoutStream = await container.logs({
      stdout: true,
      stderr: false,
      follow: false,
      timestamps: false,
    });

    const stderrStream = await container.logs({
      stdout: false,
      stderr: true,
      follow: false,
      timestamps: false,
    });

    const stdout = stdoutStream
      .toString("utf8")
      .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, "");
    const stderr = stderrStream
      .toString("utf8")
      .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, "");

    console.log(`Execution completed with status: ${result.StatusCode}`);
    console.log("STDOUT:", stdout);
    console.log("STDERR:", stderr);

    if (result.StatusCode !== 0) {
      // If there's an error, combine stdout and stderr for context
      const errorOutput = (stdout + "\n" + stderr).trim();
      throw new Error(
        `Execution failed with exit code ${result.StatusCode}.\n${errorOutput}`
      );
    }

    return stdout.trim() || "(No output)";
  } catch (error) {
    console.error("Error during container execution:", error);

    if (container) {
      try {
        // If the timeout was hit, we need to stop the container
        console.log("Stopping container...");
        await container.stop({ t: 5 }); // Give it 5 seconds to stop gracefully
      } catch (stopError) {
        console.error("Error stopping container:", stopError);
      }
    }
    // Re-throw the original error (e.g., timeout error or the execution failure)
    throw error;
  } finally {
    // Cleanup
    if (container) {
      try {
        console.log("Removing container...");
        await container.remove({ force: true });
      } catch (removeError) {
        console.error("Error removing container:", removeError);
      }
    }

    // Clean up the temporary directory and file
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`Cleaned up temp directory: ${tempDir}`);
    } catch (err) {
      console.error(`Failed to remove temp directory ${tempDir}:`, err);
    }
  }
};

// Helper to pull image if not present
const pullImage = async (imageName) => {
  try {
    // Check if the image exists locally
    const image = docker.getImage(imageName);
    await image.inspect();
    console.log(`Image ${imageName} found locally.`);
  } catch (error) {
    // If the image is not found (error code 404), then pull it
    if (error.statusCode === 404) {
      console.log(
        `Image ${imageName} not found locally. Pulling from Docker Hub...`
      );
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (err, stream) => {
          if (err) {
            console.error("Error pulling image:", err);
            return reject(err);
          }

          docker.modem.followProgress(stream, (err, output) => {
            if (err) {
              console.error("Error during image pull:", err);
              return reject(err);
            }
            console.log(`Image ${imageName} pulled successfully.`);
            resolve(output);
          });
        });
      });
    } else {
      // For any other error, re-throw it
      console.error("Error inspecting image:", error);
      throw error;
    }
  }
};

module.exports = { runCodeInContainer };
