import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { responsivePlan } from "./responsive-plan.mjs";
import {
  fixtureEnvironmentScript,
  withFixtureEnvironment,
} from "./environment.mjs";
const root = process.cwd();
const fixtureRoot = resolve(root, ".sites-runtime/tailwind-qa");
const publicRoot = resolve(root, "public");
const port = Number(process.env.RIPARIM_TAILWIND_QA_PORT ?? 4196);
const scenes = [
  "landing",
  "catalogue",
  "privacy",
  "login",
  "register",
  "recovery",
  "reset",
  "reviews",
  "settings",
  "business",
  "requests",
  "claim",
  "admin",
  "admin-users",
  "admin-reviews",
  "admin-businesses",
  "admin-auth",
  "profile",
  "controls",
  "catalogue-loading",
  "profile-loading",
  "not-found",
  "page-error",
];
const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const options = (values) =>
  values.map((value) => `<option>${escape(String(value))}</option>`).join("");
const index = `<!doctype html><html><head><meta charset="utf-8"><title>Riparim Tailwind comparison</title><style>body{font:14px system-ui;margin:0;background:#e4e8ed;color:#142235}#controls{padding:12px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;background:white}label{display:grid;gap:4px}select,input,button{font:inherit;padding:5px}iframe{display:block;border:0;background:white;margin:16px 0;box-shadow:0 0 0 1px #8291a3}#report{white-space:pre-wrap;padding:12px;background:white;margin:0;max-height:35vh;overflow:auto}.hint{margin:10px}</style></head><body><form id="controls"><label>Build<select name="variant">${options(["before", "after"])}</select></label><label>Scene<select name="scene">${options(scenes)}</select></label><label>Theme<select name="theme">${options(["light", "dark", "system"])}</select></label><label>Locale<select name="locale">${options(["de", "sq", "en"])}</select></label><label>State<select name="state">${options(["ready", "empty", "loading", "error", "revoked", "unconfigured", "filter-drawer", "review-dialog", "gallery", "menu", "picker", "business-editor"])}</select></label><label>Role<select name="role">${options(["guest", "member", "admin"])}</select></label><label>CSS width<select name="width">${options([...new Set([1280, 320, 390, 719, 720, 721, 768, 999, 1000, 1001, 1600, ...responsivePlan().map((item) => item.width)])].sort((a, b) => a - b))}</select></label><label>CSS height<select name="height">${options([900, 500, 519, 520, 521, 599, 600, 601, 602, 667])}</select></label><button type="submit">Load fixture</button><button type="button" id="measure">Record geometry</button><button type="button" id="save">Save geometry</button><button type="button" id="batch">Capture baseline matrix</button><button type="button" id="responsive">Capture responsive matrix</button><button type="button" id="detail">Save detail snapshot</button></form><p class="hint">Real application components; fictional accounts and intercepted requests. Use browser keyboard/zoom/preferences for interaction checks. The frame has the selected CSS viewport.</p><iframe title="Riparim fixture" id="fixture"></iframe><pre id="report" aria-live="polite">Waiting for fixture</pre><script>const form=document.getElementById('controls'),frame=document.getElementById('fixture'),report=document.getElementById('report');let latest;const params=new URLSearchParams(location.search);for(const [key,value] of params){if(form.elements[key])form.elements[key].value=value;}function load(){const values=new URLSearchParams(new FormData(form));frame.style.width=values.get('width')+'px';frame.style.height=values.get('height')+'px';frame.src='/'+values.get('variant')+'/scene.html?'+values;history.replaceState({},'', '/?'+values);report.textContent='Loading '+values.get('scene');}form.addEventListener('submit',event=>{event.preventDefault();load();});document.getElementById('measure').onclick=()=>frame.contentWindow.postMessage('riparim-qa-measure',location.origin);window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='riparim-qa-report'){latest=event.data.report;report.textContent=JSON.stringify(latest,null,2);}});document.getElementById('save').onclick=async()=>{if(latest){const response=await fetch('/save-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant:form.elements.variant.value,report:latest})});report.textContent+='\\nSaved: '+await response.text();}};async function saveDetail(){const values=Object.fromEntries(new FormData(form)),doc=frame.contentDocument;await doc.fonts.ready;const nodes=[...doc.querySelectorAll('header,header *,main,main *,footer,footer *,[role=dialog],[role=dialog] *')];const properties=['fontSize','fontWeight','fontFamily','lineHeight','margin','padding','border','borderTopWidth','borderBottomWidth','minHeight','display','position','boxSizing','gap','gridTemplateColumns','color','backgroundColor','opacity','visibility','translate','transform'];const elements=nodes.slice(0,1200).map((node,index)=>{const rect=node.getBoundingClientRect(),css=frame.contentWindow.getComputedStyle(node);return {index,tag:node.tagName,id:node.id,role:node.getAttribute('role'),className:node.getAttribute('class'),ui:node.getAttribute('data-ui'),text:node.textContent.trim().slice(0,100),x:rect.x,y:rect.y,width:rect.width,height:rect.height,...Object.fromEntries(properties.map(name=>[name,css[name]]))};});const result={...values,width:Number(values.width),height:Number(values.height),truncated:nodes.length>1200,elements};const response=await fetch('/save-detail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant:values.variant,report:result})});report.textContent='Saved detailed native snapshot: '+await response.text()+' ('+elements.length+' elements)';}document.getElementById('detail').onclick=saveDetail;async function captureMatrix(button,responsive){button.disabled=true;const variant=form.elements.variant.value;const plan=await(await fetch(responsive?'/responsive-plan':'/capture-plan')).json();let completed=0;for(const item of plan){for(const key of ['scene','theme','locale','state','role','width','height'])form.elements[key].value=String(item[key]);form.elements.variant.value=variant;latest=null;load();const captured=await new Promise(resolve=>{const timeout=setTimeout(()=>{window.removeEventListener('message',receive);resolve(null);},6000);function receive(event){const value=event.data?.report;if(event.origin===location.origin&&event.data?.type==='riparim-qa-report'&&value.scene===item.scene&&value.theme===item.theme&&value.locale===item.locale&&value.state===item.state&&value.role===item.role&&value.width===item.width&&value.height===item.height){clearTimeout(timeout);window.removeEventListener('message',receive);resolve(value);}}window.addEventListener('message',receive);});if(captured){await fetch('/save-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variant,report:captured})});await saveDetail();}report.textContent='Capturing native iframe geometry: '+(++completed)+' / '+plan.length;}button.disabled=false;report.textContent='Captured '+completed+' native iframe cases. Interactive overlay states require their actual triggers and separate manual captures.';}document.getElementById('batch').onclick=event=>captureMatrix(event.currentTarget,false);document.getElementById('responsive').onclick=event=>captureMatrix(event.currentTarget,true);load();</script></body></html>`;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/fixture-environment.js") {
      response.setHeader("Content-Type", "text/javascript; charset=utf-8");
      response.end(fixtureEnvironmentScript);
      return;
    }
    if (pathname === "/") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(index);
      return;
    }
    if (pathname === "/responsive-plan") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(responsivePlan()));
      return;
    }
    if (pathname === "/capture-plan") {
      const { readdir } = await import("node:fs/promises");
      const directory = resolve(fixtureRoot, "before/geometry");
      const plan = [];
      for (const file of (await readdir(directory))
        .filter((file) => file.endsWith(".json"))
        .sort()) {
        const report = JSON.parse(
          await readFile(resolve(directory, file), "utf8"),
        );
        if (
          [
            "ready",
            "empty",
            "loading",
            "error",
            "revoked",
            "unconfigured",
          ].includes(report.state)
        )
          plan.push(
            Object.fromEntries(
              [
                "scene",
                "theme",
                "locale",
                "state",
                "role",
                "width",
                "height",
              ].map((key) => [key, report[key]]),
            ),
          );
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(plan));
      return;
    }
    if (
      ["/save-report", "/save-detail"].includes(pathname) &&
      request.method === "POST"
    ) {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 1024 * 1024) throw Error("Report too large");
      }
      const { variant, report } = JSON.parse(body);
      if (
        !["before", "after"].includes(variant) ||
        !scenes.includes(report.scene)
      )
        throw Error("Invalid report");
      const name =
        [
          report.scene,
          report.locale,
          report.theme,
          report.state,
          report.role,
          report.width,
          report.height,
        ]
          .join("-")
          .replace(/[^a-zA-Z0-9-]/g, "_") + ".json";
      const { mkdir, writeFile } = await import("node:fs/promises");
      const directory = resolve(
        fixtureRoot,
        variant,
        pathname === "/save-detail" ? "details" : "geometry",
      );
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, name),
        JSON.stringify(report, null, 2),
      );
      response.end(name);
      return;
    }
    const base = /^\/(before|after)\//.test(pathname)
      ? fixtureRoot
      : publicRoot;
    const path = await realpath(
      resolve(base, "." + decodeURIComponent(pathname)),
    );
    if (!path.startsWith(base + sep)) throw Error("Invalid asset path");
    response.setHeader(
      "Content-Type",
      types[extname(path)] ?? "application/octet-stream",
    );
    response.setHeader("Cache-Control", "no-store");
    const content = await readFile(path);
    response.end(
      /^\/(before|after)\/scene\.html$/.test(pathname)
        ? withFixtureEnvironment(content.toString("utf8"))
        : content,
    );
  } catch {
    response.writeHead(404);
    response.end("Fixture unavailable");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Tailwind QA: http://127.0.0.1:${port}/`),
);
