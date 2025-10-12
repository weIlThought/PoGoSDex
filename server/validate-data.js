import { readFile } from "fs/promises";
import path from "path";
import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });

const deviceSchema = {
  type: "object",
  required: ["id", "brand", "model", "type", "compatible"],
  properties: {
    id: { type: "string", minLength: 1 },
    brand: { type: "string", minLength: 1 },
    model: { type: "string", minLength: 1 },
    os: { type: "string" },
    type: { type: "string", minLength: 1 },
    compatible: { type: "boolean" },
    notes: {
      type: "array",
      items: { type: "string" },
    },
    rootLinks: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    price: { type: "string" },
    priceRange: { type: "string" },
    pogo: { type: "string" },
    pgsharp: { type: "string" },
  },
  additionalProperties: true,
};

const newsSchema = {
  type: "object",
  required: ["id", "title", "date"],
  properties: {
    id: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    date: { type: "string", minLength: 1 },
    url: { type: "string" },
    summary: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
  additionalProperties: true,
};

const devicesValidator = ajv.compile({
  type: "array",
  items: deviceSchema,
});

const newsValidator = ajv.compile({
  type: "array",
  items: newsSchema,
});

export async function validateData(logger) {
  const baseDir = path.resolve(process.cwd());
  const devicesPath = path.join(baseDir, "data", "devices.json");
  const newsPath = path.join(baseDir, "data", "news.json");

  const [devicesRaw, newsRaw] = await Promise.all([
    readFile(devicesPath, "utf8"),
    readFile(newsPath, "utf8"),
  ]);

  const devicesData = JSON.parse(devicesRaw);
  const newsData = JSON.parse(newsRaw);

  if (!devicesValidator(devicesData)) {
    const errors = ajv.errorsText(devicesValidator.errors);
    throw new Error(`Invalid devices.json: ${errors}`);
  }

  if (!newsValidator(newsData)) {
    const errors = ajv.errorsText(newsValidator.errors);
    throw new Error(`Invalid news.json: ${errors}`);
  }

  logger.info("JSON data validated successfully");
  return { devicesData, newsData };
}
