const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{createRequire}=require('node:module');
function load(relative,stubs={}) {
 const file=path.resolve(relative),real=createRequire(file),exports={};
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 vm.runInNewContext(source,{exports,React,process,URL,require:n=>Object.hasOwn(stubs,n)?stubs[n]:real(n)});return exports;
}
test('actual dashboard SSR preserves signup selection and renders only its product navigation',async()=>{
 const Link=({children,href,...props})=>React.createElement('a',{href,...props},children);
 const Nav=load('components/WorkspaceNav.js',{'next/link':{default:Link}}).default;
 for(const selected of [['markets'],['sports'],['sports','markets']]) {
  const page=load('pages/dashboard.js',{
   '../lib/authServer':{requireServerUser:async()=>({user:{user_metadata:{interests:selected}}})},
   '../lib/ceoAccess':{getCeoAccess:async()=>({allowed:false})},
   '../lib/supabaseClient':{},'../components/WorkspaceNav':{default:Nav},
   '../components/LatestSignals':{default:()=>null},'../components/ResearchGuide':{default:()=>null},'../components/AccessJourney':{default:()=>null},
  });
  const result=await page.getServerSideProps({req:{},res:{setHeader(){}}});
  assert.deepEqual(Array.from(result.props.initialInterests),selected);
  const html=renderToStaticMarkup(React.createElement(page.default,result.props));
  const nav=html.match(/<nav[^>]*aria-label="Workspace"[^>]*>(.*?)<\/nav>/s)[1];
  assert.equal(nav.includes('>Sports<'),selected.includes('sports'));
  assert.equal(nav.includes('>Markets<'),selected.includes('markets'));
  assert.match(html,selected[0]==='markets'?/Your market view\./:/Your sports signal\./);
 }
});
