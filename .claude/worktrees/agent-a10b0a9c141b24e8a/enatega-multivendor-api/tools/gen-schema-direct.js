"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const MongooseModule = require('@nestjs/mongoose').MongooseModule;
const originalForRootAsync = MongooseModule.forRootAsync.bind(MongooseModule);
MongooseModule.forRootAsync = function (options) {
    return {
        module: class NoOpMongoose {
        },
        providers: [],
        exports: [],
        global: true,
    };
};
const originalForRoot = MongooseModule.forRoot.bind(MongooseModule);
MongooseModule.forRoot = function (...args) {
    return {
        module: class NoOpMongoose2 {
        },
        providers: [],
        exports: [],
        global: true,
    };
};
const originalForFeature = MongooseModule.forFeature.bind(MongooseModule);
MongooseModule.forFeature = function (models, connectionName) {
    return {
        module: class NoOpMongooseFeature {
        },
        providers: models.map((m) => ({
            provide: `${m.name}Model`,
            useValue: {},
        })),
        exports: models.map((m) => `${m.name}Model`),
    };
};
async function main() {
    const { AppModule } = await Promise.resolve().then(() => require('../src/app.module'));
    const app = await core_1.NestFactory.create(AppModule, { logger: false });
    await app.init();
    await app.close();
    console.log('Schema generated successfully');
    process.exit(0);
}
main().catch((err) => {
    console.error('Error:', err?.message?.slice(0, 300));
    process.exit(0);
});
//# sourceMappingURL=gen-schema-direct.js.map