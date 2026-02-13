const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');
const CONTROLLERS_DIR = path.join(__dirname, '..', 'src', 'controllers');

function listRouteFiles() {
  return fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.js'));
}

function readFile(p) { return fs.readFileSync(p, 'utf8'); }

function resolveControllerPath(requirePath, routeFile) {
  // handle relative paths like '../controllers/ticket.controller'
  const routeDir = ROUTES_DIR;
  const full = path.resolve(routeDir, requirePath + (requirePath.endsWith('.js') ? '' : '.js'));
  return full;
}

function findRouteControllers(routeContent) {
  const requireRegex = /const\s+(\w+)\s*=\s*require\(['"](.+controllers\/.+?)['"]\)\s*;/g;
  const controllers = [];
  let m;
  while ((m = requireRegex.exec(routeContent)) !== null) {
    controllers.push({ varName: m[1], requirePath: m[2] });
  }
  return controllers;
}

function findControllerMethodUsages(routeContent, varName) {
  const usageRegex = new RegExp(varName + "\\.([a-zA-Z0-9_]+)", 'g');
  const methods = new Set();
  let m;
  while ((m = usageRegex.exec(routeContent)) !== null) methods.add(m[1]);
  return Array.from(methods);
}

function controllerExportsContain(controllerContent, methodName) {
  const exportsRegex = new RegExp("exports\\." + methodName + "\\b");
  const moduleRegex = new RegExp("module\\.exports\\s*=\\s*\\{[\s\S]*?\\b" + methodName + "\\b");
  return exportsRegex.test(controllerContent) || moduleRegex.test(controllerContent);
}

function main() {
  const routeFiles = listRouteFiles();
  const report = [];

  for (const rf of routeFiles) {
    const routePath = path.join(ROUTES_DIR, rf);
    const content = readFile(routePath);
    const controllers = findRouteControllers(content);
    for (const c of controllers) {
      const controllerFile = resolveControllerPath(c.requirePath, rf);
      if (!fs.existsSync(controllerFile)) {
        report.push({ route: rf, controllerVar: c.varName, controllerPath: c.requirePath, error: 'Controller file not found: ' + controllerFile });
        continue;
      }
      const controllerContent = readFile(controllerFile);
      const methods = findControllerMethodUsages(content, c.varName);
      for (const m of methods) {
        if (!controllerExportsContain(controllerContent, m)) {
          report.push({ route: rf, controllerVar: c.varName, controllerFile: path.relative(process.cwd(), controllerFile), missing: m });
        }
      }
    }
  }

  if (report.length === 0) {
    console.log('OK: All route controller methods found.');
    process.exit(0);
  }

  console.log('MISSING HANDLERS REPORT:');
  for (const r of report) {
    if (r.error) {
      console.log(`- [${r.route}] ${r.controllerVar} -> ${r.error}`);
    } else {
      console.log(`- [${r.route}] ${r.controllerVar} (${r.controllerFile}) missing method: ${r.missing}`);
    }
  }
  process.exit(2);
}

main();
