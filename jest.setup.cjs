// jest.setup.cjs
import { createRequire } from "module";
global.require = createRequire(import.meta.url);
