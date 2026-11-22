"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
process.env.SKIP_MONGOOSE = '1';
const app_module_1 = require("../src/app.module");
async function main() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { logger: false });
    await app.close();
    process.exit(0);
}
main().catch((err) => {
    console.error(err.message?.substring(0, 100));
    process.exit(0);
});
//# sourceMappingURL=gen-schema.js.map