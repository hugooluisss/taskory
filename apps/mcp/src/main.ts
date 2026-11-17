import { loadConfig } from "./config.js";
import { createHttpServer } from "./http/server.js";

const config = loadConfig();
const server = createHttpServer(config);
server.listen(config.port);
