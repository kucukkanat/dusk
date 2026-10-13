(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

/* ---------- icons (Dusk set + extras at the same 1.5 stroke) ---------- */
var EXTRA={
  back:"M15 5l-7 7 7 7", chev:"M9 6l6 6-6 6", bookmark:"M6.5 4h11v16l-5.5-4-5.5 4z",
  image:"M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9h.01", server:"M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01",
  key:"M12 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM11 12l8-8M16 7l3 3M14 9l2 2", wallet:"M4 7h14a2 2 0 0 1 2 2v9H4zM4 7l11-3v3M16 13h.01",
  edit:"M5 19h4L19 9l-4-4L5 15zM13 7l4 4", trash:"M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13",
  up:"M12 19V5M6 11l6-6 6 6", down:"M12 5v14M6 13l6 6 6-6",
  eyeoff:"M3 3l18 18M10.6 6.1A9.5 9.5 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.1M6.3 7.8C4.3 9.4 3 12 3 12s4 6 9 6a8.7 8.7 0 0 0 3.6-.8M9.9 10a3 3 0 0 0 4.1 4.1",
  palette:"M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1-.8-1.4-.8-2.4a1.5 1.5 0 0 1 1.5-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 11h.01M10 7.5h.01M14.5 7.5h.01",
  gesture:"M4 12h14M14 8l4 4-4 4M4 6v12", list:"M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  lock:"M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3", logout:"M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  hash:"M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16", refresh:"M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  keyboard:"M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10", info:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  book:"M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z", send:"M4 12 20 4l-6 16-3-7z",
  quote:"M6 7h4v4c0 3-2 5-4 6M14 7h4v4c0 3-2 5-4 6", at:"M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1",
  warn:"M12 4 2.5 20h19zM12 10v4M12 17h.01", wifi:"M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01",
  sun:"M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  verified:"M12 3l2.4 1.8 3 .1.9 2.8 2.4 1.8-.9 2.9.9 2.9-2.4 1.7-.9 2.9-3 .1L12 21l-2.4-1.8-3-.1-.9-2.9-2.4-1.7.9-2.9-.9-2.9 2.4-1.8.9-2.8 3-.1zM8.5 12.2l2.3 2.3 4.7-4.7"
};
function ic(n,l){
  if(EXTRA[n]){var a=l?' role="img" aria-label="'+esc(l)+'"':' aria-hidden="true"';return '<svg class="dk-icon" viewBox="0 0 24 24"'+a+'><path d="'+EXTRA[n]+'"/></svg>'}
  return Dusk.icon(n,l);
}

/* ---------- helpers ---------- */
var store={get:function(k,d){try{var v=localStorage.getItem('dusk.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:function(k,v){try{localStorage.setItem('dusk.'+k,JSON.stringify(v))}catch(e){}}};
function hsh(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rnd(seed,len,cs){var h=hsh(seed),o='';for(var i=0;i<len;i++){h=(Math.imul(h,1103515245)+12345)>>>0;o+=cs[(h>>>16)%cs.length]}return o}
var B32='qpzry9x8gf2tvdw0s3jn54khce6mua7l',HEX='0123456789abcdef';
function mid(s,a,b){a=a||10;b=b||4;return s.length>a+b+1?s.slice(0,a)+'…'+s.slice(-b):s}
function fmt(n){n=Math.round(n);if(n<1000)return String(n);var k=n/1000;return (k<10?k.toFixed(1).replace(/\.0$/,''):String(Math.round(k)))+'k'}
function sats(n){return Number(n).toLocaleString('en-US')}
function ago(m){return m<1?'now':m<60?Math.round(m)+'m':m<1440?Math.round(m/60)+'h':Math.round(m/1440)+'d'}
function agoLong(m){
  var d=new Date(Date.now()-m*60000), clock=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  var rel=m<1?'Just now':m<60?Math.round(m)+(Math.round(m)===1?' minute ago':' minutes ago'):m<1440?Math.round(m/60)+(Math.round(m/60)===1?' hour ago':' hours ago'):Math.round(m/1440)+' days ago';
  return rel+' · '+clock;
}
function initials(n){return n.split(/\s+/).map(function(w){return w[0]}).join('').slice(0,2).toUpperCase()}
function handle(id){var u=U[id];return u&&u.handle?u.handle:id}
function idFromHandle(h){if(U.me.handle===h)return 'me';for(var k in U){if(U[k].handle===h)return k}return h}
function verifiedHTML(u){return u.verified===false?'<span class="verified">'+esc(u.nip05)+'</span>':'<span class="verified">'+ic('verified','Verified')+esc(u.nip05)+'</span>'}
function avInner(u){return u.photo?'<img src="'+u.photo+'" alt="">':initials(u.name)}
function avatar(id,cls){var u=U[id];return '<span class="dk-avatar'+(cls?' '+cls:'')+'" data-tone="'+u.tone+'" aria-hidden="true">'+avInner(u)+'</span>'}
function avatarBtn(id,cls){var u=U[id];
  if(id==='me')return '<button class="dk-avatar'+(cls?' '+cls:'')+'" data-tone="'+u.tone+'" data-act="me-menu" aria-label="Your profile: view or edit">'+avInner(u)+'</button>';
  return '<button class="dk-avatar'+(cls?' '+cls:'')+'" data-tone="'+u.tone+'" data-go="profile:'+id+'" aria-label="'+esc(u.name)+', profile">'+avInner(u)+'</button>'}
function first(id){return U[id].name.split(' ')[0]}
function plural(n,a,b){return n===1?a:b}

/* ---------- sample data ---------- */
var U={
  me:{name:'Tolga',nip05:'tolga@dusk.social',tone:'mist',about:'Building Dusk, a calm Nostr client. TypeScript, Bun, quiet software.',following:214,followers:'1.3k'},
  ada:{name:'Ada Wren',nip05:'ada@wren.ink',tone:'rose',about:'Photographer. North Sea light, mostly.',following:180,followers:'8.4k',followsYou:true},
  jun:{name:'Jun Okafor',nip05:'jun@relaywork.net',tone:'peach',about:'Writes relays in Rust. Thinks about sync more than is healthy.',following:402,followers:'3.1k',followsYou:true},
  mira:{name:'Mira Tal',nip05:'mira@longform.club',tone:'lilac',about:'Essays on software and attention.',following:96,followers:'12k'},
  sol:{name:'Sol Haddad',nip05:'sol@sol.garden',tone:'sage',about:'Tomatoes and Lightning nodes, in that order.',following:312,followers:'2.2k',followsYou:true},
  noor:{name:'Noor Amari',nip05:'noor@amari.studio',tone:'butter',about:'Type designer. Drawing letters for small screens.',following:150,followers:'4.6k'},
  pieter:{name:'Pieter Brandt',nip05:'pieter@fietspad.nl',tone:'mist',about:'Bikes, maps, cafes without music.',following:88,followers:'640'},
  kit:{name:'Kit Lindqvist',nip05:'kit@lindqvist.dev',tone:'lilac',about:'Client dev. Asks too many questions about relay hints.',following:260,followers:'1.9k',followsYou:true},
  rafa:{name:'Rafa Ortiz',nip05:'rafa@ortiz.cafe',tone:'peach',about:'Coffee, zines, Sundays.',following:140,followers:'720',followsYou:true},
  lena:{name:'Lena Voss',nip05:'lena@voss.page',tone:'rose',about:'New here. Be nice.',following:12,followers:'31'},
  theo:{name:'Theo Marchetti',nip05:'theo@polder.photo',tone:'sage',about:'Fog, fields, early trains.',following:75,followers:'2.8k'}
};
U.me.handle='tolga';
U.dusk={name:'Dusk',handle:'dusk',nip05:'hello@dusk.social',tone:'lilac',about:'Updates from the Dusk client team. Calm software for Nostr.',following:3,followers:'410',isIdent:true};
U.nightowl={name:'Night owl',handle:'nightowl',nip05:'nightowl@dusk.social',tone:'peach',about:'A quiet account for late reading.',following:40,followers:'6',isIdent:true};
Object.keys(U).forEach(function(k){U[k].id=k;U[k].npub='npub1'+rnd('npub'+k,58,B32);U[k].hex=rnd('hex'+k,64,HEX)});
var FOF=['pieter','kit','rafa'];
var MEDIA={
  tide:{alt:'Low tide reflecting the sky on a wide beach',bg:'linear-gradient(180deg,#c9d8e6 0%,#e8d9c4 38%,#f2c9a9 52%,#9fb8bf 53%,#c5d5d6 70%,#7d97a0 100%)'},
  cafe:{alt:'A cortado next to a stack of zines on a wooden table',bg:'radial-gradient(circle at 32% 42%,#d8b48c 0 13%,#8a6446 13.5% 17%,transparent 17.5%),linear-gradient(135deg,#4f3d30,#9a7759 58%,#d9c3a5)'},
  fog:{alt:'Fog over flat fields with a line of trees',bg:'linear-gradient(180deg,#e2e5e2 0%,#cfd5d1 52%,#a2ad9f 53%,#b9c2b6 72%,#8e9a8b 100%)'},
  dusk:{alt:'The sea at dusk, violet sky over dark water',bg:'linear-gradient(180deg,#3b3a5c 0%,#a3708a 46%,#efb99c 60%,#2f3a4a 61%,#1d2430 100%)'},
  specimen:{alt:'Type specimen showing the word Hamburgefonstiv',specimen:true}
};
var N={};
function mk(id,author,t,text,o){o=o||{};var n={id:id,author:author,t:t,text:text,reposts:o.r||0,likes:o.l||0,zaps:o.z||0,media:o.media,article:o.article,quote:o.quote,cw:o.cw,parent:o.parent};N[id]=n;return n}
mk('n1','ada',4,'Low tide at Scheveningen this morning. The whole beach turned into a mirror for about twenty minutes, then the clouds closed in. #photography',{r:18,l:214,z:4200,media:'tide'});
mk('n2','jun',22,'Shipped negentropy sync in my relay. Initial sync of 1.2M events went from 9 minutes to 40 seconds. Writing it up this weekend. #relay',{r:31,l:156,z:2100});
mk('n3','mira',47,'New essay: software that waits for you instead of chasing you.',{r:44,l:301,z:8800,article:'a1'});
mk('n4','sol',63,"First frost warning tonight. Brought the last green tomatoes inside to ripen on the windowsill. My node routed 312 payments this week, which is more than the tomatoes did.",{r:6,l:88,z:500});
mk('n5','noor',95,'Working on a typeface for small screens. Open apertures, generous spacing, nothing that collapses at 13px. Early specimen. #typography',{r:12,l:140,z:1200,media:'specimen'});
mk('n6','pieter',130,'Rode the new bike path along the Vecht today. 18 km, zero cars, two herons. #cycling',{r:3,l:41});
mk('n7','kit',150,'Question for client devs: how do you handle relay hints when the outbox list is empty? Falling back to the last-seen relays feels fragile. #nostrdev',{r:5,l:37,z:210});
mk('n8','rafa',190,'Cortado, rain, and a stack of zines. Good Sunday.',{r:2,l:63,z:100,media:'cafe'});
mk('n9','ada',240,"Reminder that you don't owe anyone an instant reply.",{r:52,l:412,z:1500});
mk('n10','mira',300,"If an app needs a red badge to get me to open it, it doesn't trust itself.",{r:61,l:520,z:3000});
mk('n11','sol',380,'Zapped my first podcast episode at 100 sats a minute. Strange how much more closely I listened. #zaps',{r:4,l:77,z:600});
mk('n12','noor',460,'Tabular figures in timestamps. Small thing, but it stops the whole feed from shimmering as times update. #typography',{r:15,l:190,z:700});
mk('n13','pieter',600,"Made a map of every cafe within 2 km that has a power outlet and doesn't play music. It's a short map.",{r:9,l:120});
mk('n14','lena',30,"Hello Nostr. First week here, and this is the first app that doesn't make me feel like I'm defusing a bomb every time I open it.",{r:1,l:22,z:21,cw:'Mild rant about notifications'});
mk('n15','theo',75,'Fog over the polder, 07:40. #photography',{r:7,l:96,z:800,media:'fog'});
mk('n16','jun',520,"Relay operators: please publish your NIP-11 limits. Clients can't be polite if they don't know the rules. #relay",{r:22,l:180,z:400});
mk('n18','ada',700,'This is exactly the map I needed.',{l:30,quote:'n13'});
mk('n19','mira',90,'@tolga would Dusk support long-form drafts? I would move my writing over tomorrow.',{l:12});
mk('d1','dusk',800,'Dusk 0.1 is out as a clickable prototype. Calm by default, customizable when you want it.',{r:12,l:88,z:2100});
mk('m1','me',180,'Dusk is clickable now. Swipe a note right to reply, left to like. Long-press for everything else.',{r:9,l:64,z:1000});
mk('m2','me',1500,'Calm software checklist: no red badges, no counters ticking up while you watch, one quiet place for network status.',{r:14,l:98,z:500});
mk('r1','sol',3,'That light. Scheveningen at low tide is underrated.',{parent:'n1',l:4});
mk('r2','noor',2,'The reflection on the left looks like a watercolor wash.',{parent:'n1',l:6});
mk('r3','ada',1,"@noor that's the plan for the print, actually.",{parent:'n1',l:2});
mk('r4','kit',15,'Did you hit any trouble with clock skew between relays?',{parent:'n2',l:3});
mk('r5','jun',12,"@kit Some. Negentropy doesn't care much about timestamps, the fingerprint covers it.",{parent:'n2',l:5});
mk('r6','jun',140,'I keep a small per-author cache of where I last saw their notes, then ask a couple of big relays as a last resort. Works fine in practice.',{parent:'n7',l:11});
mk('r7','me',120,'Same in Dusk. Outbox first, last-seen cache second, and nobody has to see any of it.',{parent:'n7',l:8});
mk('r8','sol',40,'Read it twice. The bit about notifications as interruptions you pay for stuck with me.',{parent:'n3',l:14});
mk('r9','ada',30,'Sending this to everyone I know who builds apps.',{parent:'n3',l:9});
mk('r10','ada',170,"The swipe threshold feels right. Firm enough that I don't like things by accident.",{parent:'m1',l:5});
mk('r11','kit',160,'Is the gesture map stored as an app setting on Nostr, so it follows me between devices?',{parent:'m1',l:3});
var ARTICLES={a1:{title:'Notes on calm software',author:'mira',minutes:8,note:'n3',body:[
  'Most apps are built to be opened. Very few are built to be closed. The difference shows up in small places: a badge that turns red, a counter that ticks while you watch, a sound you did not ask for.',
  'Calm software starts from a different question. Instead of asking how to bring people back, it asks what this person needs right now, and how little it can show them to get it.',
  'A few rules I keep coming back to. Status stays quiet until it matters. Numbers round. Anything that can wait should wait, and say so plainly.',
  'Gestures help, as long as they stay shortcuts. A swipe that likes a note is lovely. A swipe that is the only way to like a note is a riddle.',
  'On open networks this gets harder and more important. There are servers, keys, signatures and payment rails under every tap. All of it is real, and almost none of it needs to be on screen.',
  'The test I use is simple. After I close the app, do I feel like I left a room, or escaped one?'
]}};
var REPOSTS=[{by:'sol',note:'n13',t:200},{by:'jun',note:'n10',t:280}];
var INCOMING_POOL=[
  {author:'noor',text:'Specimen v2 is up. Tightened the spacing in the lowercase, the 13px size reads much better now. #typography'},
  {author:'ada',text:'Same beach, eight hours later. #photography',media:'dusk'},
  {author:'jun',text:'Write-up on negentropy sync is live. Long, with diagrams. Sorry in advance. #relay'},
  {author:'sol',text:'Green tomato chutney attempt one. The kitchen smells like a vinegar factory.'}
];
var NOTIFS=[
  {id:'x1',kind:'like',who:['ada','noor'],others:12,note:'m1',t:30,unread:true},
  {id:'x2',kind:'zap',who:['jun'],amount:1000,note:'m1',comment:'Love the swipe thresholds',t:55,unread:true},
  {id:'x3',kind:'mention',who:['mira'],note:'n19',t:90,unread:true},
  {id:'x4',kind:'reply',who:['kit'],note:'r11',t:160},
  {id:'x7',kind:'reply',who:['ada'],note:'r10',t:170},
  {id:'x5',kind:'follow',who:['rafa'],t:240},
  {id:'x6',kind:'repost',who:['sol'],note:'m2',t:600}
];
var CONVS={
  c1:{with:'jun',unread:2,msgs:[{f:'jun',x:'Saw the prototype. Want to try it against my relay?',t:400},{f:'me',x:'Yes please. Which URL?',t:390},{f:'jun',x:'wss://relay.relaywork.net, negentropy is on.',t:20},{f:'jun',x:'Tell me if the first sync feels slow on mobile.',t:18}]},
  c4:{with:'sol',unread:1,msgs:[{f:'sol',x:'Your node or mine for the zap demo?',t:240}]},
  c2:{with:'mira',unread:0,msgs:[{f:'me',x:'Would you read an early draft of the Dusk onboarding copy?',t:1500},{f:'mira',x:'Happily. Keep it short, that is my only note so far.',t:1440}]},
  c3:{with:'ada',unread:0,msgs:[{f:'me',x:'Could I use your tide photo in the Dusk screenshots?',t:3000},{f:'ada',x:'Sure. Credit me in the alt text.',t:2900}]}
};
var TRENDING=[{tag:'photography',n:'1.2k'},{tag:'zaps',n:'2.4k'},{tag:'nostrdev',n:'640'},{tag:'typography',n:'310'},{tag:'cycling',n:'280'},{tag:'relay',n:'190'}];
var ACT={reply:{label:'Reply',icon:'reply'},like:{label:'Like',icon:'like'},zap:{label:'Zap',icon:'zap'},repost:{label:'Repost',icon:'repost'},bookmark:{label:'Bookmark',icon:'bookmark'},mute:{label:'Mute',icon:'mute'}};
var SOURCES={following:'Following',fof:'Friends of friends',global:'Global',tag:'Hashtag',long:'Long reads',close:'Close friends'};

/* ---------- state ---------- */
var popLike=null;
var IDENT={
  tolga:{signer:'Remote signer',added:'Your main identity'},
  dusk:{signer:'Browser extension',added:'Added 2 weeks ago',state:{follows:['jun','kit','mira'],liked:[],bookmarks:[],reposted:[],zapped:{},muted:[],mutedWords:[],close:[],
    notifs:[{id:'y1',kind:'like',who:['jun','kit'],others:30,note:'d1',t:40,unread:true},{id:'y2',kind:'follow',who:['lena'],t:300}],convs:{}}},
  nightowl:{signer:'Key on this device',added:'Added last month',state:{follows:['mira','theo','ada'],liked:[],bookmarks:['n3'],reposted:[],zapped:{},muted:[],mutedWords:[],close:[],notifs:[],convs:{}}}
};
var IDENT_ORDER=['tolga','dusk','nightowl'];
var HEARTS='<span class="hearts" aria-hidden="true">'+[[-18,-34,1,-18,'rose',0],[14,-42,.85,14,'peach',60],[-3,-52,1.15,-4,'rose',30],[24,-22,.7,22,'lilac',90],[-26,-16,.7,-24,'lilac',120],[6,-30,.6,8,'peach',150]].map(function(h){return '<svg viewBox="0 0 24 24" style="--dx:'+h[0]+'px;--dy:'+h[1]+'px;--s:'+h[2]+';--r:'+h[3]+'deg;--d:'+h[5]+'ms;color:var(--'+h[4]+'-ink)"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'}).join('')+'</span>';
var DEFAULT_SETTINGS={theme:'auto',accent:'mist',density:'comfortable',hideCounts:false,swipeStart:'reply',swipeEnd:'like',advanced:false,offline:false,
  notif:{mentions:true,dms:true,zaps:true,likes:false,follows:true,quiet:true}};
var S={
  tab:'home',stack:[],feed:'following',
  settings:Object.assign({},DEFAULT_SETTINGS,store.get('settings',{})),
  feeds:store.get('feeds',[{id:'following',name:'Following',src:'following'},{id:'fof',name:'Friends of friends',src:'fof'},{id:'global',name:'Global',src:'global'},{id:'photo',name:'#photography',src:'tag',tag:'photography'},{id:'long',name:'Long reads',src:'long'}]),
  follows:new Set(['ada','jun','mira','sol','noor','kit']),
  close:new Set(['ada','sol']),
  liked:new Set(['n9']),reposted:new Set(),bookmarks:new Set(['n12','n3']),zapped:{},
  muted:new Set(),mutedWords:['spoiler'],revealed:new Set(),fresh:new Set(),
  incoming:[],pool:INCOMING_POOL.slice(),
  wallet:{connected:false,balance:48210,defaultZap:100,oneTap:false},
  servers:[
    {url:'wss://relay.damus.io',read:true,write:true,status:'ok',ms:84},
    {url:'wss://nos.lol',read:true,write:true,status:'ok',ms:112},
    {url:'wss://relay.primal.net',read:true,write:false,status:'ok',ms:96},
    {url:'wss://relay.relaywork.net',read:true,write:true,status:'slow',ms:910},
    {url:'wss://nostr.example.org',read:true,write:false,status:'err',ms:0}
  ],
  syncing:false,activityFilter:'all',profileTab:{},searchQ:'',
  signer:'Remote signer',activeIdent:'tolga'
};
S.settings.notif=Object.assign({},DEFAULT_SETTINGS.notif,S.settings.notif||{});
if(!S.feeds.some(function(f){return f.id===S.feed}))S.feed=S.feeds[0].id;
function saveSettings(){store.set('settings',S.settings)}
function saveFeeds(){store.set('feeds',S.feeds)}

var hostTheme=document.documentElement.getAttribute('data-theme');
var mq768=matchMedia('(min-width:768px)'),mq1100=matchMedia('(min-width:1100px)');
function wide(){return mq1100.matches}
function tablet(){return mq768.matches}

/* ---------- model helpers ---------- */
function isMutedNote(n){
  if(S.muted.has(n.author))return true;
  var t=n.text.toLowerCase();
  return S.mutedWords.some(function(w){return w&&t.indexOf(w.toLowerCase())>=0});
}
function repliesOf(id){return Object.keys(N).map(function(k){return N[k]}).filter(function(x){return x.parent===id&&!x.deleted&&!isMutedNote(x)}).sort(function(a,b){return b.t-a.t})}
function topNotes(){return Object.keys(N).map(function(k){return N[k]}).filter(function(x){return !x.parent&&!x.deleted})}
function feedById(id){return S.feeds.filter(function(f){return f.id===id})[0]||S.feeds[0]}
function feedItems(f){
  var notes=topNotes(), items=[];
  var keep=function(n){
    switch(f.src){
      case 'following':return S.follows.has(n.author)||n.author==='me';
      case 'fof':return FOF.indexOf(n.author)>=0;
      case 'global':return true;
      case 'tag':return n.text.toLowerCase().indexOf('#'+(f.tag||'').toLowerCase())>=0;
      case 'long':return !!n.article;
      case 'close':return S.close.has(n.author);
    }return false;
  };
  notes.forEach(function(n){if(keep(n)&&!isMutedNote(n))items.push({n:n,t:n.t})});
  if(f.src==='following'||f.src==='global'){
    REPOSTS.forEach(function(r){var n=N[r.note];if(!n||n.deleted||isMutedNote(n))return;if(f.src==='global'||S.follows.has(r.by)||r.by==='me')items.push({n:n,t:r.t,by:r.by})});
  }
  return items.sort(function(a,b){return a.t-b.t});
}
function cnt(n){return (S.settings.hideCounts||!n)?'':fmt(n)}

/* ---------- text ---------- */
function fmtText(s){
  var h=esc(s);
  h=h.replace(/(^|\s)@([a-z]+)/g,function(m,p,u){var id=idFromHandle(u);return U[id]?p+'<button class="linkbtn" data-go="profile:'+id+'">@'+u+'</button>':m});
  h=h.replace(/(^|\s)#([a-z0-9]+)/gi,function(m,p,t){return p+'<button class="linkbtn" data-go="tag:'+t.toLowerCase()+'">#'+t+'</button>'});
  h=h.replace(/(wss:\/\/[^\s<,]+)/g,'<span class="key">$1</span>');
  return h.replace(/\n/g,'<br>');
}

/* ---------- note ---------- */
function sideLabel(a,n){
  if(n){if(a==='like'&&S.liked.has(n.id))return 'Unlike';if(a==='repost'&&S.reposted.has(n.id))return 'Undo repost';if(a==='bookmark'&&S.bookmarks.has(n.id))return 'Remove';if(a==='mute')return 'Mute @'+handle(n.author)}
  return ACT[a].label;
}
function swipeSides(start,end,n){
  return '<div class="dk-swipe__side dk-swipe__side--start" data-action="'+start+'">'+ic(ACT[start].icon)+'<span>'+esc(sideLabel(start,n))+'</span></div>'+
         '<div class="dk-swipe__side dk-swipe__side--end" data-action="'+end+'"><span>'+esc(sideLabel(end,n))+'</span>'+ic(ACT[end].icon)+'</div>';
}
function mediaHTML(n){
  if(!n.media)return '';
  if(n.media.indexOf('data:')===0)return '<button class="dk-note__media" data-act="media" data-id="'+n.id+'" aria-label="Open image"><img src="'+n.media+'" alt="Attached image"></button>';
  var m=MEDIA[n.media];if(!m)return '';
  if(m.specimen)return '<button class="dk-note__media" data-act="media" data-id="'+n.id+'" aria-label="Open image: '+esc(m.alt)+'"><div class="specimen"><b>Hamburgefonstiv</b><span>Regular 13 · 16 · 34 px · open apertures</span></div></button>';
  return '<button class="dk-note__media" data-act="media" data-id="'+n.id+'" aria-label="Open image: '+esc(m.alt)+'" style="background:'+m.bg+'"></button>';
}
function articleCard(n){var a=ARTICLES[n.article];return '<button class="card-link" data-go="article:'+n.article+'"><span class="card-link__eyebrow">'+ic('book')+'Long read · '+a.minutes+' min</span><span class="card-link__title">'+esc(a.title)+'</span><span class="card-link__text">'+esc(a.body[0])+'</span></button>'}
function quoteCard(id){var q=N[id];if(!q||q.deleted)return '<div class="card-link"><span class="card-link__text">This note was deleted.</span></div>';var u=U[q.author];return '<button class="card-link" data-go="thread:'+id+'"><span class="card-link__eyebrow">'+ic('quote')+esc(u.name)+' · '+ago(q.t)+'</span><span class="card-link__text">'+esc(q.text)+'</span></button>'}
function noteHTML(n,o){
  o=o||{};var u=U[n.author],s=S.settings;
  var liked=S.liked.has(n.id),rp=S.reposted.has(n.id),zp=S.zapped[n.id]||0;
  var nrep=repliesOf(n.id).length;
  var hidden=n.cw&&!S.revealed.has(n.id);
  var by=o.by?'<div class="note-by">'+ic('repost')+'<span>'+(o.by==='me'?'You':esc(U[o.by].name))+' reposted</span></div>':'';
  var par=(n.parent&&!o.inThread&&N[n.parent])?'<div class="note-by">'+ic('reply')+'<span>Replying to @'+handle(N[n.parent].author)+'</span></div>':'';
  var body=hidden
    ?'<div class="cw">'+ic('eyeoff')+'<span class="cw__text">'+esc(n.cw)+'</span><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="cw" data-id="'+n.id+'">Show</button></div>'
    :'<p class="dk-note__body">'+fmtText(n.text)+'</p>'+(n.cw?'<button class="linkbtn cw-hide" data-act="cw" data-id="'+n.id+'">Hide again</button>':'')+mediaHTML(n)+(n.article?articleCard(n):'')+(n.quote?quoteCard(n.quote):'');
  var pend=n.pending?'<span class="pend">'+ic('wifi')+'Waiting to send</span>':'';
  var likes=n.likes+(liked?1:0),reps=n.reposts+(rp?1:0),zs=n.zaps+zp;
  var meta=o.focus?'<div class="focus-meta">'+agoLong(n.t)+(s.hideCounts?'':[likes?' · '+fmt(likes)+plural(likes,' like',' likes'):'',reps?' · '+fmt(reps)+plural(reps,' repost',' reposts'):'',zs?' · '+fmt(zs)+' sats':''].join(''))+'</div>':'';
  var actions='<div class="dk-note__actions">'+
    '<button class="dk-iconbtn" data-act="reply" data-id="'+n.id+'" aria-label="Reply'+(nrep?', '+nrep+' replies':'')+'">'+ic('reply')+'<span>'+cnt(nrep)+'</span></button>'+
    '<button class="dk-iconbtn is-repost" aria-pressed="'+rp+'" data-act="repost" data-id="'+n.id+'" aria-label="Repost">'+ic('repost')+'<span>'+cnt(reps)+'</span></button>'+
    '<button class="dk-iconbtn is-like'+(popLike===n.id?' pop':'')+'" aria-pressed="'+liked+'" data-act="like" data-id="'+n.id+'" aria-label="Like">'+ic('like')+'<span class="cnt">'+cnt(likes)+'</span>'+(popLike===n.id?HEARTS:'')+'</button>'+
    '<button class="dk-iconbtn is-zap" aria-pressed="'+(zp>0)+'" data-act="zap" data-id="'+n.id+'" aria-label="Zap">'+ic('zap')+'<span>'+cnt(zs)+'</span></button>'+
    '<button class="dk-iconbtn" data-act="more" data-id="'+n.id+'" aria-label="More options">'+ic('more')+'</button></div>';
  var start=o.preview?s.swipeStart:s.swipeStart,end=s.swipeEnd;
  return '<div class="dk-swipe'+(o.isNew?' is-new':'')+'" data-note="'+n.id+'"'+(o.preview?' data-preview':'')+'>'+swipeSides(start,end,n)+
    '<div class="dk-swipe__content"><article class="dk-note'+(o.focus?' is-focus':'')+'" tabindex="0" aria-label="'+esc(u.name)+': '+esc(n.text.slice(0,90))+'">'+
    avatarBtn(n.author)+'<div class="note-main">'+by+par+
    '<div class="dk-note__head"><span class="dk-note__name">'+esc(u.name)+'</span><span class="dk-note__meta">@'+handle(n.author)+' · '+ago(n.t)+'</span></div>'+
    body+pend+meta+actions+'</div></article></div></div>';
}
function emptyHTML(t,p,btn){return '<div class="empty"><h2>'+esc(t)+'</h2><p>'+esc(p)+'</p>'+(btn||'')+'</div>'}
function followBtn(id,sm){var on=S.follows.has(id);return '<button class="dk-btn '+(on?'dk-btn--secondary':'dk-btn--primary')+(sm?' dk-btn--sm':'')+'" data-act="follow" data-id="'+id+'" aria-pressed="'+on+'">'+(on?'Following':'Follow')+'</button>'}
function personRow(id,extra){var u=U[id];return '<div class="person">'+avatarBtn(id)+'<button class="person__text" data-go="profile:'+id+'"><b>'+esc(u.name)+'</b><span>'+esc(extra||u.nip05)+'</span></button>'+(id==='me'?'':followBtn(id,true))+'</div>'}

/* ---------- sync pill ---------- */
function pendingCount(){return Object.keys(N).filter(function(k){return N[k].pending&&!N[k].deleted}).length}
function syncHTML(){
  var s=S.settings;
  if(s.offline){var p=pendingCount();return '<button class="dk-sync" data-state="offline" data-act="sync"><span class="dk-sync__dot"></span>Offline'+(p?' · '+p+' waiting':'')+'</button>'}
  if(S.syncing)return '<button class="dk-sync" data-state="pending" data-act="sync"><span class="dk-sync__dot"></span>Sending</button>';
  return '';
}

/* ---------- views ---------- */
var V={};
V.home=function(){
  var f=feedById(S.feed),items=feedItems(f);
  var chips=S.feeds.map(function(x){return '<button class="dk-chip" role="tab" aria-selected="'+(x.id===f.id)+'" data-act="feed" data-id="'+x.id+'">'+esc(x.name)+'</button>'}).join('')+
    '<button class="dk-chip" data-act="feed-add" aria-label="Add a feed">'+ic('plus')+'</button>';
  var pill=S.incoming.length?'<button class="newpill" data-act="show-new">'+(S.incoming.length===1?'1 new note':S.incoming.length+' new notes')+'</button>':'';
  var list=items.map(function(i){return noteHTML(i.n,{by:i.by,isNew:S.fresh.has(i.n.id)})}).join('');
  return {key:'home:'+f.id,title:tablet()?f.name:'Dusk',fab:true,ptr:true,home:true,
    actions:'<button class="dk-iconbtn" data-act="refresh" aria-label="Refresh">'+ic('refresh')+'</button>',
    sub:'<div class="dk-chips" role="tablist" aria-label="Feeds">'+chips+'</div>',
    body:'<div class="ptr"><span>Pull to refresh</span></div>'+pill+'<div class="list">'+list+'</div>'+
      (items.length?'<p class="endcap">You\'re all caught up</p>':emptyHTML('Nothing here yet','Notes from this feed will show up here. Follow a few people or pick another feed.'))};
};
V.search=function(){
  return {key:'search',fab:true,titleHTML:'<label class="searchbox">'+ic('search')+'<span class="sr-only">Search</span><input id="q" type="search" autocomplete="off" placeholder="Search people, notes and #tags" value="'+esc(S.searchQ)+'"></label>',
    body:'<div id="search-results">'+searchResults(S.searchQ)+'</div>'};
};
function tagRow(t){return '<button class="person row-btn tagrow" data-go="tag:'+t.tag+'"><span class="tagicon">'+ic('hash')+'</span><span class="person__text"><b>#'+esc(t.tag)+'</b><span>'+t.n+' notes today</span></span>'+ic('chev')+'</button>'}
function searchResults(q){
  q=(q||'').trim().toLowerCase();
  if(!q){
    var sugg=Object.keys(U).filter(function(id){return id!=='me'&&!U[id].isIdent&&!S.follows.has(id)});
    return '<div class="group-label">Trending tags</div><div class="group">'+TRENDING.map(tagRow).join('')+'</div>'+
      '<div class="group-label">People you might like</div><div class="group">'+sugg.map(function(id){return personRow(id)}).join('')+'</div>';
  }
  var qq=q.replace(/^[#@]/,'');
  var people=Object.keys(U).filter(function(id){var u=U[id];return (u.name+' '+u.nip05+' '+u.about).toLowerCase().indexOf(qq)>=0});
  var tags=TRENDING.filter(function(t){return t.tag.indexOf(qq)>=0});
  if(q[0]==='#'&&!tags.length&&qq)tags=[{tag:qq,n:'a few'}];
  var notes=topNotes().filter(function(n){return !isMutedNote(n)&&n.text.toLowerCase().indexOf(qq)>=0}).sort(function(a,b){return a.t-b.t});
  if(!people.length&&!tags.length&&!notes.length)return emptyHTML('No results','Nothing matches “'+q+'”. Try a name, a handle like ada@wren.ink, or a #tag.');
  return (people.length?'<div class="group-label">People</div><div class="group">'+people.map(function(id){return personRow(id)}).join('')+'</div>':'')+
    (tags.length?'<div class="group-label">Tags</div><div class="group">'+tags.map(tagRow).join('')+'</div>':'')+
    (notes.length?'<div class="group-label">Notes</div><div class="list">'+notes.map(function(n){return noteHTML(n)}).join('')+'</div>':'');
}
var NK={like:{tone:'rose',icon:'like'},zap:{tone:'peach',icon:'zap'},mention:{tone:'lilac',icon:'at'},reply:{tone:'mist',icon:'reply'},follow:{tone:'sage',icon:'user'},repost:{tone:'sage',icon:'repost'}};
function notifHTML(x){
  var k=NK[x.kind],w=x.who.map(function(id){return '<b>'+esc(U[id].name)+'</b>'});
  var who=w.length>1?w.slice(0,-1).join(', ')+(x.others?', ':' and ')+w[w.length-1]:w[0];
  if(x.others)who+=' and '+x.others+' others';
  var text={like:who+' liked your note',zap:who+' zapped you '+fmt(x.amount)+' sats',mention:who+' mentioned you',reply:who+' replied',follow:who+' followed you',repost:who+' reposted your note'}[x.kind];
  var ex='';
  if(x.kind==='zap')ex='“'+esc(x.comment)+'” · on: '+esc(N[x.note].text);
  else if(x.note&&N[x.note])ex=esc(N[x.note].text);
  var go=x.kind==='follow'?'profile:'+x.who[0]:'thread:'+x.note;
  return '<div class="dk-swipe" data-notif="'+x.id+'">'+
    '<div class="dk-swipe__side dk-swipe__side--start" data-action="read">'+ic('check')+'<span>'+(x.unread?'Mark read':'Mark unread')+'</span></div>'+
    '<div class="dk-swipe__side dk-swipe__side--end" data-action="mute"><span>Mute '+esc(first(x.who[0]))+'</span>'+ic('mute')+'</div>'+
    '<div class="dk-swipe__content"><button class="notif'+(x.unread?'':' is-read')+'" data-go="'+go+'" data-read="'+x.id+'"><span class="notif__icon" style="background:var(--'+k.tone+')">'+ic(k.icon)+'</span><span><span class="notif__text">'+text+'</span>'+(ex?'<span class="notif__ex">'+ex+'</span>':'')+'</span><span class="notif__side"><span>'+ago(x.t)+'</span>'+(x.unread?'<span class="dot" aria-label="Unread"></span>':'')+'</span></button></div></div>';
}
V.activity=function(){
  var f=S.activityFilter;
  var items=NOTIFS.filter(function(x){return !S.muted.has(x.who[0])&&(f==='all'||(f==='mentions'&&(x.kind==='mention'||x.kind==='reply'))||(f==='zaps'&&x.kind==='zap')||(f==='follows'&&x.kind==='follow'))});
  var chips=[['all','All'],['mentions','Mentions and replies'],['zaps','Zaps'],['follows','Follows']].map(function(c){return '<button class="dk-chip" role="tab" aria-selected="'+(f===c[0])+'" data-act="filter" data-id="'+c[0]+'">'+c[1]+'</button>'}).join('');
  return {key:'activity:'+f,title:'Activity',fab:true,
    actions:NOTIFS.some(function(x){return x.unread})?'<button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="markall">Mark all read</button>':'',
    sub:'<div class="dk-chips" role="tablist" aria-label="Filter activity">'+chips+'</div>',
    body:items.length?'<div class="list">'+items.map(notifHTML).join('')+'</div><p class="endcap">That\'s everything from the last week</p>':emptyHTML('All quiet','Mentions, replies and zaps will show up here.')};
};
function convList(){return Object.keys(CONVS).filter(function(k){return !CONVS[k].muted&&!S.muted.has(CONVS[k].with)}).sort(function(a,b){var A=CONVS[a].msgs,B=CONVS[b].msgs;return A[A.length-1].t-B[B.length-1].t})}
V.messages=function(){
  var rows=convList().map(function(k){
    var c=CONVS[k],u=U[c.with],last=c.msgs[c.msgs.length-1];
    return '<div class="dk-swipe" data-conv="'+k+'">'+
      '<div class="dk-swipe__side dk-swipe__side--start" data-action="read">'+ic('check')+'<span>'+(c.unread?'Mark read':'Mark unread')+'</span></div>'+
      '<div class="dk-swipe__side dk-swipe__side--end" data-action="mute"><span>Mute</span>'+ic('mute')+'</div>'+
      '<div class="dk-swipe__content"><button class="conv'+(c.unread?' is-unread':'')+'" data-go="chat:'+k+'">'+avatar(c.with)+'<span style="min-width:0"><span class="conv__name">'+esc(u.name)+'</span><span class="conv__last" style="display:block">'+(last.f==='me'?'You: ':'')+esc(last.x)+'</span></span><span class="notif__side"><span>'+ago(last.t)+'</span>'+(c.unread?'<span class="dot" aria-label="'+c.unread+' unread"></span>':'')+'</span></button></div></div>';
  }).join('');
  return {key:'messages',title:'Messages',actions:'<button class="dk-iconbtn" data-act="new-dm" aria-label="New message">'+ic('edit')+'</button>',
    body:rows?'<div class="list">'+rows+'</div><p class="endcap">Messages are private. Only you and the other person can read them.</p>':emptyHTML('No messages yet','Start a private conversation with anyone you follow.','<button class="dk-btn dk-btn--primary" data-act="new-dm">New message</button>')};
};
V.chat=function(scr){
  var c=CONVS[scr.id],u=U[c.with];
  var html='<div class="chat"><div class="chat__note">'+ic('lock')+'Private. Only you and '+esc(first(c.with))+' can read these.</div>';
  c.msgs.forEach(function(m,i){var mine=m.f==='me';html+='<div class="bubble'+(mine?' mine':'')+'">'+fmtText(m.x)+'</div>';var nx=c.msgs[i+1];if(!nx||nx.f!==m.f||m.t-nx.t>30)html+='<div class="bubble-time'+(mine?' mine':'')+'">'+(m.pending?'Waiting to send':ago(m.t))+'</div>'});
  html+='</div>';
  return {key:'chat:'+scr.id,title:u.name,chat:true,
    actions:'<button class="dk-iconbtn" data-go="profile:'+c.with+'" aria-label="View profile">'+ic('user')+'</button>',
    body:html,
    footer:'<form class="composer" data-form="chat" data-id="'+scr.id+'"><label class="sr-only" for="chat-input">Message</label><textarea id="chat-input" rows="1" placeholder="Message '+esc(first(c.with))+'"></textarea><button class="send" type="submit" aria-label="Send">'+ic('send')+'</button></form>'};
};
V.thread=function(scr){
  var n=N[scr.id];
  if(!n||n.deleted)return {key:'thread:'+scr.id,title:'Note',body:emptyHTML('Note deleted','This note is no longer available.')};
  var parent=n.parent&&N[n.parent]&&!N[n.parent].deleted?N[n.parent]:null;
  var reps=repliesOf(n.id).reverse();
  return {key:'thread:'+n.id,title:'Note',
    actions:'<button class="dk-iconbtn" data-act="more" data-id="'+n.id+'" aria-label="More options">'+ic('more')+'</button>',
    body:'<div class="list">'+(parent?noteHTML(parent,{inThread:true}):'')+noteHTML(n,{focus:true,inThread:true})+'</div>'+
      (reps.length?'<div class="thread-label">'+reps.length+plural(reps.length,' reply',' replies')+'</div><div class="list">'+reps.map(function(r){return noteHTML(r,{inThread:true})}).join('')+'</div>':'<p class="endcap">No replies yet</p>'),
    footer:'<div class="replybar"><button data-act="reply" data-id="'+n.id+'">'+avatar('me','dk-avatar--sm')+'Reply to '+esc(first(n.author))+'…</button></div>'};
};
V.article=function(scr){
  var a=ARTICLES[scr.id],n=N[a.note],u=U[a.author];
  var liked=S.liked.has(n.id);
  return {key:'article:'+scr.id,title:'',
    actions:'<button class="dk-iconbtn" data-act="bookmark" data-id="'+n.id+'" aria-label="'+(S.bookmarks.has(n.id)?'Remove bookmark':'Bookmark')+'">'+ic('bookmark')+'</button><button class="dk-iconbtn" data-act="more" data-id="'+n.id+'" aria-label="More options">'+ic('more')+'</button>',
    body:'<article class="article"><h1>'+esc(a.title)+'</h1><div class="byline">'+avatarBtn(a.author)+'<span><b>'+esc(u.name)+'</b>'+a.minutes+' min read · '+ago(n.t)+' ago</span></div>'+
      a.body.map(function(p){return '<p>'+esc(p)+'</p>'}).join('')+
      '<div class="article__actions"><button class="dk-btn dk-btn--secondary" data-act="like" data-id="'+n.id+'">'+ic('like')+(liked?'Liked':'Like')+'</button><button class="dk-btn dk-btn--zap" data-act="zap" data-id="'+n.id+'">'+ic('zap')+'Zap '+esc(first(a.author))+'</button><button class="dk-btn dk-btn--secondary" data-go="thread:'+n.id+'">'+ic('reply')+'Discuss</button></div></article>'};
};
V.tag=function(scr){
  var t=scr.id,f={src:'tag',tag:t},items=feedItems(f);
  var saved=S.feeds.some(function(x){return x.src==='tag'&&x.tag===t});
  return {key:'tag:'+t,title:'#'+t,fab:true,
    actions:saved?'<button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="feed" data-id="'+S.feeds.filter(function(x){return x.src==='tag'&&x.tag===t})[0].id+'" data-home>In your feeds</button>':'<button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="save-tag" data-id="'+t+'">'+ic('plus')+'Save as feed</button>',
    body:items.length?'<div class="list">'+items.map(function(i){return noteHTML(i.n)}).join('')+'</div><p class="endcap">That\'s all for #'+esc(t)+'</p>':emptyHTML('No notes yet','Nobody you can see has used #'+t+' recently.')};
};
V.me=function(){var v=V.profile({id:'me'});v.fab=true;return v};
V.profile=function(scr){
  var id=scr.id,u=U[id],me=id==='me';
  var tab=S.profileTab[id]||'notes';
  var tabs=[['notes','Notes'],['replies','Replies']];if(me)tabs.push(['bookmarks','Bookmarks']);
  var list;
  if(tab==='notes')list=topNotes().filter(function(n){return n.author===id}).concat(REPOSTS.filter(function(r){return r.by===id}).map(function(r){return {_r:r}}));
  var notes;
  if(tab==='notes'){
    var arr=topNotes().filter(function(n){return n.author===id}).map(function(n){return {n:n,t:n.t}});
    REPOSTS.forEach(function(r){if(r.by===id&&N[r.note]&&!N[r.note].deleted)arr.push({n:N[r.note],t:r.t,by:r.by})});
    notes=arr.sort(function(a,b){return a.t-b.t}).map(function(i){return noteHTML(i.n,{by:i.by})}).join('');
  }else if(tab==='replies'){
    notes=Object.keys(N).map(function(k){return N[k]}).filter(function(n){return n.parent&&n.author===id&&!n.deleted}).sort(function(a,b){return a.t-b.t}).map(function(n){return noteHTML(n)}).join('');
  }else{
    notes=Array.from(S.bookmarks).map(function(k){return N[k]}).filter(function(n){return n&&!n.deleted}).map(function(n){return noteHTML(n)}).join('');
  }
  var muted=S.muted.has(id);
  var btns=me?'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="edit-profile">'+ic('edit')+'Edit profile</button>'
    :(muted?'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="unmute" data-id="'+id+'">Unmute</button>':'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="dm" data-id="'+id+'" aria-label="Message '+esc(u.name)+'">'+ic('message')+'</button>'+followBtn(id,true));
  return {key:'profile:'+id+':'+tab,title:me&&!scr.pushed?'You':u.name,fab:me,
    actions:me?'<button class="dk-iconbtn" data-go="settings:root" aria-label="Settings">'+ic('settings')+'</button>':'<button class="dk-iconbtn" data-act="profile-more" data-id="'+id+'" aria-label="More options">'+ic('more')+'</button>',
    body:'<div class="banner" style="--tone:var(--'+u.tone+')"></div><div class="phead"><div class="phead__top"><button class="dk-avatar dk-avatar--lg" data-tone="'+u.tone+'" data-act="'+(me?'me-menu':'avatar-view')+'" data-id="'+id+'" aria-label="'+(me?'Your photo: view or edit':'View '+esc(u.name)+'\'s photo')+'">'+avInner(u)+(me?'<span class="av-edit" aria-hidden="true">'+ic('edit')+'</span>':'')+'</button><div class="phead__btns">'+btns+'</div></div>'+
      '<div><h2 class="phead__name">'+esc(u.name)+'</h2><span class="verified">'+ic('verified','Verified')+esc(u.nip05)+'</span></div>'+
      '<p class="phead__about">'+fmtText(u.about)+'</p>'+
      '<div class="phead__meta"><span><b>'+u.following+'</b> following</span><span><b>'+u.followers+'</b> followers</span>'+(u.followsYou?'<span class="followsyou">Follows you</span>':'')+'</div>'+
      '<div class="keyrow"><span class="key">'+mid(u.npub,12,6)+'</span><button class="dk-iconbtn" data-act="copy" data-copy="'+u.npub+'" data-msg="Copied public key" aria-label="Copy public key">'+ic('copy')+'</button></div></div>'+
      '<div class="dk-chips ptabs" role="tablist" aria-label="Profile sections">'+tabs.map(function(t){return '<button class="dk-chip" role="tab" aria-selected="'+(tab===t[0])+'" data-act="ptab" data-id="'+id+'" data-v="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div>'+
      (notes?'<div class="list">'+notes+'</div>':emptyHTML(tab==='bookmarks'?'No bookmarks':'Nothing here yet',tab==='bookmarks'?'Long-press a note or swipe to bookmark it. Bookmarks are private.':'Notes will show up here.'))};
};

/* settings */
function navRow(icon,title,sub,go,val){return '<button class="dk-row row-btn" data-go="settings:'+go+'">'+ic(icon)+'<span class="dk-row__text"><span class="dk-row__title" style="display:block">'+title+'</span>'+(sub?'<span class="dk-row__sub" style="display:block">'+sub+'</span>':'')+'</span>'+(val?'<span class="row-val">'+val+'</span>':'')+'<span class="chev">'+ic('chev')+'</span></button>'}
function toggleRow(key,title,sub,on){var id='t-'+key.replace(/\./g,'-');return '<label class="dk-row" for="'+id+'"><span class="dk-row__text"><span class="dk-row__title" style="display:block">'+title+'</span>'+(sub?'<span class="dk-row__sub" style="display:block">'+sub+'</span>':'')+'</span><input type="checkbox" class="dk-toggle" id="'+id+'" data-toggle="'+key+'"'+(on?' checked':'')+'></label>'}
function group(label,inner,help){return (label?'<div class="group-label">'+label+'</div>':'')+'<div class="group">'+inner+'</div>'+(help?'<p class="group-help">'+help+'</p>':'')}
function chipset(key,opts,cur,disabledVal){return '<div class="chipset" role="radiogroup">'+opts.map(function(o){return '<button class="dk-chip" role="radio" aria-checked="'+(cur===o[0])+'" aria-selected="'+(cur===o[0])+'" data-act="set" data-k="'+key+'" data-v="'+o[0]+'"'+(o[0]===disabledVal?' disabled title="Used on the other side"':'')+'>'+o[1]+'</button>'}).join('')+'</div>'}
var SET_TITLES={root:'Settings',appearance:'Appearance',gestures:'Gestures',feeds:'Feeds',wallet:'Lightning wallet',notifications:'Notifications',muted:'Muted',account:'Keys and sign-in',identities:'Wallet',servers:'Servers',about:'About Dusk'};
V.settings=function(scr){
  var sec=scr.id||'root',s=S.settings,b='';
  if(sec==='root'){
    var ok=S.servers.filter(function(x){return x.status!=='err'}).length;
    b=group('','<button class="dk-row row-btn" data-act="edit-profile">'+avatar('me')+'<span class="dk-row__text"><span class="dk-row__title" style="display:block">'+esc(U.me.name)+'</span><span class="dk-row__sub" style="display:block">'+esc(U.me.nip05)+'</span></span><span class="row-val">Edit</span></button>')+
      group('Make it yours',navRow('palette','Appearance','Theme, accent, density','appearance')+navRow('gesture','Gestures','Swipe right: '+ACT[s.swipeStart].label+' · Swipe left: '+ACT[s.swipeEnd].label,'gestures')+navRow('list','Feeds',S.feeds.length+' feeds','feeds'))+
      group('Zaps',navRow('zap','Lightning wallet',S.wallet.connected?sats(S.wallet.balance)+' sats':'Not connected','wallet'))+
      group('Quiet',navRow('bell','Notifications','Mentions, messages and zaps','notifications')+navRow('mute','Muted',S.muted.size+plural(S.muted.size,' person',' people')+', '+S.mutedWords.length+plural(S.mutedWords.length,' word',' words'),'muted'))+
      group('Account','<button class="dk-row row-btn" data-go="identities:all">'+ic('wallet')+'<span class="dk-row__text"><span class="dk-row__title" style="display:block">Wallet</span><span class="dk-row__sub" style="display:block">'+IDENT_ORDER.length+' identities · switch or add one</span></span><span class="chev">'+ic('chev')+'</span></button>'+navRow('key','Keys and sign-in',S.signer,'account'))+
      group('Advanced',toggleRow('advanced','Advanced mode','Show servers, signers and raw notes',s.advanced)+
        (s.advanced?navRow('server','Servers',ok+' of '+S.servers.length+' connected','servers')+toggleRow('offline','Simulate offline','Try how Dusk behaves without a connection',s.offline):''))+
      group('',navRow('info','About Dusk','','about'))+
      '<p class="group-help">Prototype. Everything here is sample data and nothing is sent anywhere.</p>';
  }else if(sec==='appearance'){
    var acc=['mist','peach','rose','sage','lilac','butter'];
    b=group('Theme',chipset('theme',[['auto','Match system'],['night','Night'],['dawn','Dawn']],s.theme))+
      group('Accent','<div class="swatches" role="radiogroup" aria-label="Accent">'+acc.map(function(a){return '<button class="swatch" role="radio" aria-checked="'+(s.accent===a)+'" style="background:var(--'+a+')" data-act="set" data-k="accent" data-v="'+a+'" aria-label="'+a[0].toUpperCase()+a.slice(1)+'">'+ic('check')+'</button>'}).join('')+'</div>')+
      group('Density',chipset('density',[['comfortable','Comfortable'],['compact','Compact']],s.density))+
      group('Numbers',toggleRow('hideCounts','Hide counts','Show likes, reposts and zaps without numbers',s.hideCounts))+
      '<div class="group-label">Preview</div><div class="list">'+noteHTML(N.n9,{preview:true})+'</div>';
  }else if(sec==='gestures'){
    var opts=Object.keys(ACT).map(function(k){return [k,ACT[k].label]});
    b=group('Swipe right',chipset('swipeStart',opts,s.swipeStart,s.swipeEnd))+
      group('Swipe left',chipset('swipeEnd',opts,s.swipeEnd,s.swipeStart),'Every swipe also has a button on the note. Long-press a note for all options.')+
      '<div class="group-label">Try it on this note</div><div class="list">'+noteHTML(N.n12,{preview:true})+'</div>'+
      group('Other gestures','<div class="row-pad"><div class="shortcuts"><b>Pull down</b><span class="caption">Refresh a feed</span><b>Swipe top bar</b><span class="caption">Move between feeds</span><b>Edge swipe</b><span class="caption">Go back</span><b>Drag sheet down</b><span class="caption">Close it</span></div></div>');
  }else if(sec==='feeds'){
    b=group('Your feeds',S.feeds.map(function(f,i){return '<div class="dk-row feed-row"><span class="dk-row__text"><label class="sr-only" for="feed-'+f.id+'">Feed name</label><input id="feed-'+f.id+'" value="'+esc(f.name)+'" data-feedname="'+f.id+'"><span class="dk-row__sub" style="display:block;padding-left:12px">'+SOURCES[f.src]+(f.tag?' · #'+esc(f.tag):'')+'</span></span>'+
      '<button class="dk-iconbtn" data-act="feed-up" data-id="'+f.id+'" aria-label="Move up"'+(i===0?' disabled':'')+'>'+ic('up')+'</button><button class="dk-iconbtn" data-act="feed-down" data-id="'+f.id+'" aria-label="Move down"'+(i===S.feeds.length-1?' disabled':'')+'>'+ic('down')+'</button><button class="dk-iconbtn" data-act="feed-del" data-id="'+f.id+'" aria-label="Remove feed"'+(S.feeds.length<2?' disabled':'')+'>'+ic('trash')+'</button></div>'}).join(''),'Rename a feed by tapping its name. The first feed opens when you start Dusk.')+
      '<div class="row-pad" style="background:none"><button class="dk-btn dk-btn--secondary dk-btn--lg" data-act="feed-add">'+ic('plus')+'Add a feed</button></div>';
  }else if(sec==='wallet'){
    var w=S.wallet;
    if(w.connected){
      b='<div class="balance"><span class="caption">Balance</span><b>'+sats(w.balance)+' sats</b><span class="caption">Demo wallet · Nostr Wallet Connect</span></div>'+
        group('Default zap',chipset('defaultZap',[['21','21'],['100','100'],['500','500'],['1000','1k'],['5000','5k']],String(w.defaultZap)))+
        group('',toggleRow('wallet.oneTap','One-tap zaps','The zap button sends your default amount right away',w.oneTap))+
        '<div class="row-pad" style="background:none"><button class="dk-btn dk-btn--danger dk-btn--lg" data-act="wallet-disconnect">Disconnect wallet</button></div>';
    }else b='<div class="row-pad" style="background:none">'+connectForm(false)+'</div>';
  }else if(sec==='notifications'){
    var nt=s.notif;
    b=group('Notify me about',toggleRow('notif.mentions','Mentions and replies','',nt.mentions)+toggleRow('notif.dms','Messages','',nt.dms)+toggleRow('notif.zaps','Zaps','',nt.zaps)+toggleRow('notif.follows','New followers','',nt.follows)+toggleRow('notif.likes','Likes and reposts','Off by default. These add up fast.',nt.likes))+
      group('Quiet hours',toggleRow('notif.quiet','Quiet from 22:00 to 07:00','Notifications wait until morning',nt.quiet),'Dusk never puts counts on the app icon.');
  }else if(sec==='muted'){
    var ppl=Array.from(S.muted);
    b=group('People',ppl.length?ppl.map(function(id){return '<div class="person">'+avatar(id)+'<span class="person__text"><b>'+esc(U[id].name)+'</b><span>'+esc(U[id].nip05)+'</span></span><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="unmute" data-id="'+id+'">Unmute</button></div>'}).join(''):'<div class="row-pad caption">Nobody muted. Swipe or long-press a note to mute its author.</div>')+
      group('Words',(S.mutedWords.length?'<div class="chipset">'+S.mutedWords.map(function(w,i){return '<button class="dk-chip" data-act="word-del" data-id="'+i+'" aria-label="Remove '+esc(w)+'">'+esc(w)+ic('close')+'</button>'}).join('')+'</div>':'')+
        '<form class="inline-form" data-form="word"><div class="dk-field"><label class="sr-only" for="word-input">Word to mute</label><input id="word-input" placeholder="Add a word or #tag" autocomplete="off"></div><button class="dk-btn dk-btn--secondary" type="submit">Add</button></form>','Notes containing these words are hidden everywhere.');
  }else if(sec==='account'){
    b=group('Signing',
      '<button class="dk-row row-btn" data-act="signer">'+ic('key')+'<span class="dk-row__text"><span class="dk-row__title" style="display:block">Signed in with</span><span class="dk-row__sub" style="display:block">'+esc(S.signer)+(S.signer==='Remote signer'?' · your key stays on your phone':'')+'</span></span><span class="chev">'+ic('chev')+'</span></button>'+
      '<button class="dk-row row-btn" data-act="backup">'+ic('lock')+'<span class="dk-row__text"><span class="dk-row__title" style="display:block">Back up your key</span><span class="dk-row__sub" style="display:block">12 words that restore your account</span></span><span class="chev">'+ic('chev')+'</span></button>')+
      group('Public key','<div class="row-pad keyrow"><span class="key">'+U.me.npub+'</span><button class="dk-iconbtn" data-act="copy" data-copy="'+U.me.npub+'" data-msg="Copied public key" aria-label="Copy public key">'+ic('copy')+'</button></div>','Share this so people can find you. It is safe to share.')+
      '<div class="row-pad" style="background:none"><button class="dk-btn dk-btn--danger dk-btn--lg" data-act="signout">'+ic('logout')+'Sign out</button></div>';
  }else if(sec==='servers'){
    var lab={ok:'Connected',slow:'Slow',err:"Can't connect"},cls={ok:'ok',slow:'slow',err:'err'};
    b=group('Servers (relays)',S.servers.map(function(x,i){return '<div class="dk-row" style="align-items:flex-start;padding-block:12px"><span class="dk-row__text"><span class="key" style="display:block;color:var(--ink)">'+esc(x.url)+'</span><span style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"><span class="status status--'+cls[x.status]+'"><i></i>'+lab[x.status]+'</span>'+(x.status!=='err'?'<span class="caption">'+x.ms+' ms</span>':'')+
      '<button class="dk-chip mini-chip" aria-pressed="'+x.read+'" aria-selected="'+x.read+'" data-act="server-flag" data-id="'+i+'" data-v="read">Read</button><button class="dk-chip mini-chip" aria-selected="'+x.write+'" aria-pressed="'+x.write+'" data-act="server-flag" data-id="'+i+'" data-v="write">Write</button></span></span><button class="dk-iconbtn" data-act="server-del" data-id="'+i+'" aria-label="Remove '+esc(x.url)+'">'+ic('trash')+'</button></div>'}).join('')+
      '<form class="inline-form" data-form="server"><div class="dk-field" id="server-field"><label class="sr-only" for="server-input">Server address</label><input id="server-input" placeholder="wss://relay.example.com" autocomplete="off" inputmode="url"><span class="dk-field__help" id="server-help" hidden></span></div><button class="dk-btn dk-btn--secondary" type="submit">Add</button></form>',
      'Dusk also follows each person to the servers they publish to (outbox model). These are the servers you read from and write to.');
  }else if(sec==='about'){
    b='<div class="empty"><h2>Dusk</h2><p>Version 0.1 prototype. A calm Nostr client for phones and desktops.</p><button class="dk-btn dk-btn--secondary" data-act="shortcuts">'+ic('keyboard')+'Keyboard shortcuts</button><button class="dk-btn dk-btn--ghost" data-act="onboarding">Replay onboarding</button></div>';
  }
  return {key:'settings:'+sec,title:SET_TITLES[sec],body:b};
};
function identProfile(k){return k===S.activeIdent?U.me:U[k]}
function identCard(k){
  var u=identProfile(k),it=IDENT[k],active=k===S.activeIdent;
  return '<div class="ident'+(active?' is-active':'')+'"><span class="dk-avatar" data-tone="'+u.tone+'" aria-hidden="true">'+avInner(u)+'</span><div style="min-width:0"><div class="ident__name">'+esc(u.name)+'</div><span class="ident__sub">'+esc(u.nip05)+'</span><span class="ident__signer">'+ic('key')+esc(it.signer)+'</span></div>'+
    '<div class="ident__right">'+(active?'<span class="pill-active">'+ic('check')+'Active</span>':'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="ident-switch" data-id="'+k+'">Switch</button>')+
    '<button class="dk-iconbtn" data-act="ident-more" data-id="'+k+'" aria-label="Options for '+esc(u.name)+'">'+ic('more')+'</button></div></div>';
}
V.identities=function(){
  return {key:'identities',title:'Wallet',
    actions:'<button class="dk-iconbtn" data-act="ident-add" aria-label="Add identity">'+ic('plus')+'</button>',
    body:'<p class="idents-intro">Each identity is its own Nostr key with its own follows, likes and messages. Switch any time.</p>'+
      '<div class="idents">'+IDENT_ORDER.map(identCard).join('')+'</div>'+
      '<div class="row-pad" style="background:none"><button class="dk-btn dk-btn--secondary dk-btn--lg" data-act="ident-add">'+ic('plus')+'Add identity</button></div>'+
      '<p class="group-help">Keys stay in your signer, your browser extension, or encrypted on this device. Dusk never uploads them.</p>'};
};
V.ctx=function(){
  var sugg=Object.keys(U).filter(function(id){return id!=='me'&&!U[id].isIdent&&!S.follows.has(id)}).slice(0,3);
  return {key:'ctx',title:'Discover',
    body:'<div class="ctx"><form data-form="ctxsearch"><label class="searchbox">'+ic('search')+'<span class="sr-only">Search</span><input id="ctx-q" type="search" placeholder="Search Dusk" autocomplete="off"></label></form>'+
      '<section class="ctx-card"><h2>Trending</h2>'+TRENDING.slice(0,4).map(tagRow).join('')+'</section>'+
      '<section class="ctx-card"><h2>Who to follow</h2>'+(sugg.length?sugg.map(function(id){return personRow(id)}).join(''):'<p class="row-pad caption">You follow everyone we would suggest.</p>')+'</section>'+
      '<p class="caption" style="padding:0 4px">Press <span class="kbd">?</span> for keyboard shortcuts. Open a note to read it here.</p></div>'};
};

/* ---------- rendering ---------- */
var app=$('#app'),main=$('#main'),side=$('#side'),rail=$('#rail'),tabwrap=$('#tabwrap'),layer=$('#layer'),toasts=$('#toasts');
var scrollMem={},lastDepth=0;
function screenHTML(scr,ctx){
  var v=V[scr.type](scr,ctx);v.type=scr.type;
  var back=ctx.back?'<button class="dk-iconbtn" data-act="back" aria-label="Back">'+ic('back')+'</button>':ctx.close?'<button class="dk-iconbtn" data-act="close-side" aria-label="Close">'+ic('close')+'</button>':'';
  return '<section class="screen'+(ctx.enter?' enter':'')+'" data-type="'+scr.type+'">'+
    '<header class="topbar'+(back?' has-back':'')+'"'+(v.home?' data-feedswipe':'')+'>'+back+(v.titleHTML||'<h1 class="topbar__title">'+esc(v.title)+'</h1>')+'<div class="topbar__actions">'+syncHTML()+(v.actions||'')+'</div></header>'+
    (v.sub||'')+'<div class="scroller" data-key="'+v.key+'"'+(v.ptr?' data-ptr':'')+(v.chat?' data-chat':'')+'><div class="col">'+v.body+'</div></div>'+(v.footer||'')+
    (v.fab&&ctx.fab?'<button class="dk-fab" data-act="compose" aria-label="New note">'+ic('plus')+'</button>':'')+'</section>';
}
var TABS=[['home','home','Home'],['search','search','Search'],['activity','bell','Activity'],['messages','message','Messages'],['me','user','You']];
function unreadActivity(){return NOTIFS.some(function(x){return x.unread&&!S.muted.has(x.who[0])})}
function unreadDMs(){return convList().some(function(k){return CONVS[k].unread})}
function dotFor(t){return (t==='activity'&&unreadActivity())||(t==='messages'&&unreadDMs())}
function render(){
  $$('.scroller[data-key]').forEach(function(sc){scrollMem[sc.dataset.key]=sc.scrollTop});
  var focusedNote=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('[data-note]');
  var focusId=focusedNote&&document.activeElement.classList.contains('dk-note')?focusedNote.dataset.note:null;
  var w=wide(),top=S.stack[S.stack.length-1];
  var mainScr,ctx={};
  if(!w&&top){mainScr=top;ctx.back=true;ctx.enter=S.stack.length>lastDepth}
  else{mainScr={type:S.tab};ctx.fab=true}
  main.innerHTML=screenHTML(mainScr,ctx);
  if(w)side.innerHTML=top?screenHTML(top,{back:S.stack.length>1,close:S.stack.length===1,enter:S.stack.length>lastDepth}):screenHTML({type:'ctx'},{});
  else side.innerHTML='';
  lastDepth=S.stack.length;
  app.classList.toggle('no-tabbar',!w&&!!top&&top.type==='chat');
  tabwrap.innerHTML='<nav class="dk-tabbar" role="tablist" aria-label="Main">'+TABS.map(function(t){return '<button class="dk-tab" role="tab" aria-selected="'+(S.tab===t[0]&&(w||!top))+'" data-tab="'+t[0]+'"><span class="dk-tab__pill">'+ic(t[1])+'</span>'+t[2]+(dotFor(t[0])?'<span class="dk-tab__dot"></span>':'')+'</button>'}).join('')+'</nav>';
  rail.innerHTML='<div class="rail__brand"><i class="mark"></i><span>Dusk</span></div>'+TABS.map(function(t){return '<button class="rail__item" data-tab="'+t[0]+'"'+(S.tab===t[0]?' aria-current="page"':'')+' aria-label="'+t[2]+'">'+ic(t[1])+'<span class="rail__label">'+t[2]+'</span>'+(dotFor(t[0])?'<span class="dot"></span>':'')+'</button>'}).join('')+
    '<button class="rail__item" data-go="settings:root" aria-label="Settings">'+ic('settings')+'<span class="rail__label">Settings</span></button>'+
    '<button class="dk-btn dk-btn--primary dk-btn--lg rail__compose" data-act="compose" aria-label="New note">'+ic('plus')+'<span class="rail__label">New note</span></button>'+
    '<button class="rail__item rail__me" data-go="identities:all" aria-label="Wallet: your identities">'+ic('wallet')+'<span class="rail__label">Wallet</span><span class="idstack rail__label">'+IDENT_ORDER.map(function(k){return avatar(k===S.activeIdent?'me':k)}).join('')+'</span></button>';
  Dusk.mount(app);
  $$('.scroller[data-key]').forEach(function(sc){
    if(sc.hasAttribute('data-chat'))sc.scrollTop=sc.scrollHeight;
    else if(scrollMem[sc.dataset.key]!=null)sc.scrollTop=scrollMem[sc.dataset.key];
    if(sc.hasAttribute('data-ptr'))wirePTR(sc);
  });
  $$('[data-feedswipe]').forEach(wireFeedSwipe);
  if(focusId){var el=$('[data-note="'+focusId+'"] .dk-note',main)||$('[data-note="'+focusId+'"] .dk-note');el&&el.focus({preventScroll:true})}
  S.fresh.clear();
  placeSliders();
}
function applySettings(){
  var h=document.documentElement,s=S.settings;
  if(s.theme==='auto'){if(hostTheme)h.setAttribute('data-theme',hostTheme);else h.removeAttribute('data-theme')}
  else h.setAttribute('data-theme',s.theme==='night'?'dark':'light');
  if(s.accent==='mist')h.removeAttribute('data-accent');else h.setAttribute('data-accent',s.accent);
  if(s.density==='compact')h.setAttribute('data-density','compact');else h.removeAttribute('data-density');
  var bg=getComputedStyle(h).getPropertyValue('--bg').trim();var m=$('meta[name="theme-color"]');if(m&&bg)m.setAttribute('content',bg);
}

/* ---------- navigation ---------- */
function setTab(t){
  if(S.tab===t&&(wide()||!S.stack.length)){var sc=$('.scroller',main);if(sc)sc.scrollTo({top:0,behavior:'smooth'});return}
  S.tab=t;if(!wide())S.stack=[];render();
  if(t==='search'){var q=$('#q');q&&q.focus({preventScroll:true})}
}
function push(scr){
  var top=S.stack[S.stack.length-1];
  if(top&&top.type===scr.type&&top.id===scr.id)return;
  scr.pushed=true;S.stack.push(scr);delete scrollMem[scrKey(scr)];render();
}
function scrKey(scr){return scr.type+':'+(scr.id||'')}
function pop(){S.stack.pop();render()}
function goTo(spec){
  closeSheetNow();
  var i=spec.indexOf(':'),type=spec.slice(0,i),id=spec.slice(i+1);
  if(type==='profile'&&id==='me'&&!wide()&&!S.stack.length){setTab('me');return}
  if(type==='chat'){var c=CONVS[id];if(c)c.unread=0}
  push({type:type,id:id});
}

/* ---------- sheets ---------- */
var sheetState=null;
function openSheet(html,opt){
  opt=opt||{};
  if(sheetState)closeSheetNow();
  layer.hidden=false;
  layer.innerHTML='<div class="dk-scrim" data-close></div><div class="dk-sheet" role="dialog" aria-modal="true" aria-label="'+esc(opt.label||'Options')+'"><button class="dk-sheet__grab" aria-label="Close"></button><div class="sheet-body">'+html+'</div></div>';
  var sh=$('.dk-sheet',layer);sh._dusk=1;sh.style.setProperty('--dk-y','100%');
  Dusk.mount(layer);wireSheetDrag(sh);
  requestAnimationFrame(function(){requestAnimationFrame(function(){sh.style.setProperty('--dk-y','0px');layer.classList.add('is-open')})});
  sheetState={onClose:opt.onClose,prev:document.activeElement};
  setTimeout(function(){var f=$('[autofocus]',layer)||$('.sheet-body button:not([disabled]),.sheet-body input,.sheet-body textarea',layer);f&&f.focus({preventScroll:true})},80);
}
function setSheet(html){var b=$('.sheet-body',layer);if(!b)return;b.innerHTML=html;Dusk.mount(b);var f=$('[autofocus]',b)||$('button:not([disabled]),input,textarea',b);f&&f.focus({preventScroll:true})}
function closeSheet(){
  if(!sheetState)return;
  var sh=$('.dk-sheet',layer);sh&&sh.style.setProperty('--dk-y','110%');layer.classList.remove('is-open');
  var st=sheetState;sheetState=null;
  setTimeout(function(){if(sheetState)return;layer.innerHTML='';layer.hidden=true;st.onClose&&st.onClose();if(st.prev&&document.contains(st.prev))st.prev.focus({preventScroll:true})},220);
}
function closeSheetNow(){if(!sheetState)return;var st=sheetState;sheetState=null;layer.innerHTML='';layer.hidden=true;layer.classList.remove('is-open');st.onClose&&st.onClose()}
function wireSheetDrag(sh){
  $$('.dk-sheet__grab,.sheet-head',sh).forEach(function(h){
    var id=null,y0=0,t0=0,dy=0;
    h.addEventListener('pointerdown',function(e){if(e.target!==h&&e.target.closest('button,input,textarea'))return;id=e.pointerId;y0=e.clientY;t0=Date.now();dy=0;try{h.setPointerCapture(id)}catch(err){}});
    h.addEventListener('pointermove',function(e){if(e.pointerId!==id)return;dy=Math.max(0,e.clientY-y0);if(dy>3){sh.classList.add('is-dragging');sh.style.setProperty('--dk-y',dy+'px')}});
    function end(e){if(e.pointerId!==id)return;id=null;sh.classList.remove('is-dragging');var v=dy/Math.max(1,Date.now()-t0);
      if(dy>=120||(dy>24&&v>.6))closeSheet();else if(dy<4&&h.classList.contains('dk-sheet__grab'))closeSheet();else sh.style.setProperty('--dk-y','0px')}
    h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  });
}
function head(title,left){return '<div class="sheet-head'+(left?' left':'')+'"><h2 class="dk-sheet__title">'+esc(title)+'</h2></div>'}

/* toast */
var toastT=null,undoFn=null;
function toast(text,undo){
  clearTimeout(toastT);undoFn=undo||null;
  toasts.innerHTML='<div class="dk-toast" role="status"><span class="dk-toast__text">'+esc(text)+'</span>'+(undo?'<button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="undo">Undo</button>':'')+'</div>';
  requestAnimationFrame(function(){toasts.classList.add('is-on')});
  toastT=setTimeout(hideToast,undo?5000:3200);
}
function hideToast(){toasts.classList.remove('is-on');undoFn=null}
function copy(text,msg){
  var done=function(){toast(msg||'Copied')};
  try{navigator.clipboard.writeText(text).then(done,function(){fallbackCopy(text,msg)})}catch(e){fallbackCopy(text,msg)}
}
function fallbackCopy(text,msg){
  var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
  var ok=false;try{ok=document.execCommand('copy')}catch(e){}
  ta.remove();toast(ok?(msg||'Copied'):'Copy blocked here. Select the text to copy it.');
}

/* ---------- note actions ---------- */
function noteAction(a,id,src){
  var n=N[id];if(!n)return;
  if(a==='like'){if(S.liked.has(id))S.liked.delete(id);else{S.liked.add(id);popLike=id;if(src!=='swipe'){try{navigator.vibrate&&navigator.vibrate(8)}catch(e){}}}render();popLike=null;return}
  if(a==='reply'){openCompose({replyTo:id});return}
  if(a==='repost'){
    if(src==='swipe'){toggleRepost(id);return}
    openRepost(id);return;
  }
  if(a==='zap'){
    if(!S.wallet.connected){openZap(id);return}
    if(src==='swipe'||S.wallet.oneTap){zapNow(id,S.wallet.defaultZap,'');return}
    openZap(id);return;
  }
  if(a==='bookmark'){var had=S.bookmarks.has(id);if(had)S.bookmarks.delete(id);else S.bookmarks.add(id);render();toast(had?'Removed bookmark':'Bookmarked',function(){if(had)S.bookmarks.add(id);else S.bookmarks.delete(id);render()});return}
  if(a==='mute'){muteUser(n.author);return}
}
function toggleRepost(id){
  var had=S.reposted.has(id);
  if(had){S.reposted.delete(id);REPOSTS=REPOSTS.filter(function(r){return !(r.by==='me'&&r.note===id)})}
  else{S.reposted.add(id);REPOSTS.unshift({by:'me',note:id,t:0})}
  render();
  toast(had?'Repost removed':'Reposted',function(){toggleRepost(id);hideToast()});
}
function muteUser(uid){
  if(uid==='me')return;
  S.muted.add(uid);render();
  toast('Muted @'+handle(uid),function(){S.muted.delete(uid);render()});
}
function zapNow(id,amt,comment){
  amt=Number(amt);
  if(amt>S.wallet.balance){toast('Not enough sats in your wallet');return false}
  S.wallet.balance-=amt;S.zapped[id]=(S.zapped[id]||0)+amt;
  render();toast('Zapped '+sats(amt)+' sats');return true;
}
function toggleFollow(uid){
  var had=S.follows.has(uid);
  if(had)S.follows.delete(uid);else S.follows.add(uid);
  render();refreshSearch();
  toast(had?'Unfollowed '+U[uid].name:'Following '+U[uid].name);
}

/* compose */
var compose=null;
function openCompose(o){
  o=o||{};
  compose={replyTo:o.replyTo,quote:o.quote,media:null,cw:false};
  var draft=!o.replyTo&&!o.quote?store.get('draft',''):'';
  var ctxLine='';
  if(o.replyTo){var p=N[o.replyTo];ctxLine='<div class="compose-ctx">'+ic('reply')+'<span>Replying to <b>'+esc(U[p.author].name)+'</b>: '+esc(p.text.slice(0,70))+(p.text.length>70?'…':'')+'</span></div>'}
  var off=S.settings.offline;
  openSheet(
    '<div class="sheet-head"><button class="dk-btn dk-btn--ghost dk-btn--sm" data-close>Cancel</button><h2 class="dk-sheet__title">'+(o.replyTo?'Reply':o.quote?'Quote':'New note')+'</h2><button class="dk-btn dk-btn--primary dk-btn--sm" data-act="post" id="post-btn"'+(draft?'':' disabled')+'>'+(o.replyTo?'Reply':'Post')+'</button></div>'+
    ctxLine+
    '<div class="compose-row">'+avatar('me')+'<div class="dk-field"><label class="sr-only" for="compose-text">Note</label><textarea id="compose-text" rows="5" autofocus placeholder="'+(o.replyTo?'Write your reply':'What\'s on your mind?')+'">'+esc(draft)+'</textarea></div></div>'+
    '<div class="dk-field" id="cw-field" hidden style="margin-top:12px"><label class="dk-field__label" for="cw-text">Content warning</label><input id="cw-text" placeholder="Say what it\'s about, like “spoilers”"><span class="dk-field__help">People see this first and tap to show your note.</span></div>'+
    '<div id="attach"></div>'+(o.quote?quoteCard(o.quote):'')+
    '<div class="compose-tools"><button class="dk-iconbtn" data-act="attach" aria-label="Add image">'+ic('image')+'</button><button class="dk-iconbtn" aria-pressed="false" data-act="cw-toggle" aria-label="Content warning">'+ic('eyeoff')+'</button><button class="dk-iconbtn" data-act="mention" aria-label="Mention someone">'+ic('at')+'</button>'+
    '<span class="caption">'+(off?'Offline. Dusk sends it later.':'Posting as '+esc(U.me.name))+'</span></div>',
    {label:o.replyTo?'Reply':'New note',onClose:function(){compose=null}});
}
function updatePostBtn(){var t=$('#compose-text'),b=$('#post-btn');if(t&&b)b.disabled=!(t.value.trim()||(compose&&compose.media))}
function doPost(){
  if(!compose)return;
  var t=$('#compose-text'),text=t?t.value.trim():'';
  if(!text&&!compose.media)return;
  var cwv=compose.cw?($('#cw-text').value.trim()||'Sensitive'):null;
  var id='p'+Date.now();
  var n=mk(id,'me',0,text,{parent:compose.replyTo,quote:compose.quote,media:compose.media,cw:cwv});
  if(cwv)S.revealed.add(id);
  if(!compose.replyTo&&!compose.quote)store.set('draft','');
  var isReply=!!compose.replyTo;
  closeSheet();
  if(S.settings.offline){n.pending=true;render();toast('Saved. Dusk will send it when you\'re back online.');return}
  S.fresh.add(id);S.syncing=true;render();
  setTimeout(function(){S.syncing=false;render()},900);
  toast(isReply?'Replied':'Posted',function(){n.deleted=true;render();hideToast()});
}

/* repost */
function openRepost(id){
  var on=S.reposted.has(id),n=N[id];
  openSheet(head('Share this note',true)+'<div class="options">'+
    '<button class="option option--action" data-act="repost-do" data-id="'+id+'"><span class="option__icon" style="background:var(--'+(on?'clay':'sage')+');color:var(--on-accent)">'+ic('repost')+'</span><span><b>'+(on?'Undo repost':'Repost')+'</b><span>'+(on?'Remove it from your followers\' feeds':'Show it to your followers as is')+'</span></span>'+ic('chev')+'</button>'+
    '<button class="option option--action" data-act="quote" data-id="'+id+'"><span class="option__icon" style="background:var(--mist);color:var(--on-accent)">'+ic('quote')+'</span><span><b>Quote</b><span>Repost with your own comment on top</span></span>'+ic('chev')+'</button></div>',{label:'Repost'});
}
/* zap */
var zapCtx=null;
function connectForm(inSheet){
  return '<div class="sheet-stack"><div class="sheet-head left"><h2 class="dk-sheet__title">Connect a wallet</h2></div>'+
    '<p class="sheet-text">Zaps are small Lightning payments. Connect a wallet that supports Nostr Wallet Connect to send them from Dusk.</p>'+
    '<form class="sheet-stack" data-form="wallet"'+(inSheet?' data-insheet':'')+'><div class="dk-field" id="nwc-field"><label class="dk-field__label" for="nwc">Connection string</label><input id="nwc" class="key" placeholder="nostr+walletconnect://…" autocomplete="off" spellcheck="false"><span class="dk-field__help" id="nwc-help">Copy it from your wallet app, under Nostr Wallet Connect.</span></div>'+
    '<button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">Connect</button></form>'+
    '<button class="dk-btn dk-btn--secondary dk-btn--lg" data-act="wallet-demo"'+(inSheet?' data-insheet':'')+'>Use a demo wallet</button></div>';
}
function zapView(id){
  var n=N[id],u=U[n.author],amt=zapCtx.amt;
  var opts=[21,100,500,1000,5000];
  return '<div class="sheet-stack">'+head('Zap '+u.name)+
    '<div class="amounts" role="radiogroup" aria-label="Amount">'+opts.map(function(a){return '<button class="amount" role="radio" aria-checked="'+(amt===a&&!zapCtx.custom)+'" data-act="zap-amt" data-v="'+a+'">'+fmt(a)+'<small>sats</small></button>'}).join('')+
    '<button class="amount" role="radio" aria-checked="'+!!zapCtx.custom+'" data-act="zap-amt" data-v="custom">Custom<small>any amount</small></button></div>'+
    '<div class="dk-field" id="zap-custom-field"'+(zapCtx.custom?'':' hidden')+'><label class="dk-field__label" for="zap-custom">Amount in sats</label><input id="zap-custom" inputmode="numeric" placeholder="2100" value="'+(zapCtx.custom?amt||'':'')+'"></div>'+
    '<div class="dk-field"><label class="dk-field__label" for="zap-comment">Comment <span class="caption">(optional)</span></label><input id="zap-comment" placeholder="Say thanks"></div>'+
    '<button class="dk-btn dk-btn--zap dk-btn--lg" data-act="zap-send" id="zap-send"'+(amt?'':' disabled')+'>'+ic('zap')+'Zap '+(amt?sats(amt)+' sats':'')+'</button>'+
    '<p class="caption" style="text-align:center">Balance '+sats(S.wallet.balance)+' sats · goes straight to '+esc(first(n.author))+'\'s wallet</p></div>';
}
function openZap(id){
  zapCtx={id:id,amt:S.wallet.defaultZap,custom:false};
  openSheet(S.wallet.connected?zapView(id):connectForm(true),{label:'Zap',onClose:function(){zapCtx=null}});
}
/* note options */
function noteSheetHTML(id){
  var n=N[id],u=U[n.author],mine=n.author==='me',bm=S.bookmarks.has(id);
  return '<div class="sheet-head left"><h2 class="dk-sheet__title">'+esc(u.name)+'</h2></div><ul class="dk-menu">'+
    '<li><button class="dk-menu__item row-btn" data-act="note-copy" data-id="'+id+'">'+ic('copy')+'Copy link</button></li>'+
    '<li><button class="dk-menu__item row-btn" data-act="note-text" data-id="'+id+'">'+ic('quote')+'Copy text</button></li>'+
    '<li><button class="dk-menu__item row-btn" data-act="note-bookmark" data-id="'+id+'">'+ic('bookmark')+(bm?'Remove bookmark':'Bookmark')+'</button></li>'+
    (mine?'':'<li><button class="dk-menu__item row-btn" data-go="profile:'+n.author+'">'+ic('user')+'View profile</button></li>')+
    '<li><button class="dk-menu__item row-btn" data-act="details" data-id="'+id+'">'+ic('info')+'Details for nerds</button></li>'+
    (mine?'<li><button class="dk-menu__item dk-menu__item--danger row-btn" data-act="note-delete" data-id="'+id+'">'+ic('trash')+'Delete note</button></li>':'<li><button class="dk-menu__item dk-menu__item--danger row-btn" data-act="note-mute" data-id="'+id+'">'+ic('mute')+'Mute @'+handle(n.author)+'</button></li>')+
    '</ul>';
}
function openNoteSheet(id){openSheet(noteSheetHTML(id),{label:'Note options'})}
function rawEvent(n){
  var tags=[];(n.text.match(/#[a-z0-9]+/gi)||[]).forEach(function(t){tags.push(['t',t.slice(1).toLowerCase()])});
  if(n.parent)tags.push(['e',rnd('ev'+n.parent,64,HEX),'wss://relay.damus.io','reply']);
  if(n.quote)tags.push(['q',rnd('ev'+n.quote,64,HEX)]);
  if(n.cw)tags.push(['content-warning',n.cw]);
  return {id:rnd('ev'+n.id,64,HEX),pubkey:U[n.author].hex,created_at:Math.floor(Date.now()/1000-n.t*60),kind:n.article?30023:1,tags:tags,content:n.text,sig:rnd('sig'+n.id,128,HEX)};
}
function detailsHTML(id){
  var n=N[id],ev=rawEvent(n),json=JSON.stringify(ev,null,2);
  var seen=S.servers.filter(function(x){return x.status!=='err'}).slice(0,3);
  return '<div class="sheet-head"><button class="dk-iconbtn" data-act="details-back" data-id="'+id+'" aria-label="Back">'+ic('back')+'</button><h2 class="dk-sheet__title">Details for nerds</h2><span style="width:44px"></span></div>'+
    '<dl class="details"><div><dt>Kind</dt><dd>'+ev.kind+(ev.kind===1?' · Text note':' · Long-form article')+'</dd></div>'+
    '<div><dt>Event ID</dt><dd><span class="key">'+mid(ev.id,12,6)+'</span><button class="dk-iconbtn" data-act="copy" data-copy="'+ev.id+'" data-msg="Copied event ID" aria-label="Copy event ID">'+ic('copy')+'</button></dd></div>'+
    '<div><dt>Author</dt><dd><span class="key">'+mid(U[n.author].npub,12,6)+'</span><button class="dk-iconbtn" data-act="copy" data-copy="'+U[n.author].npub+'" data-msg="Copied public key" aria-label="Copy public key">'+ic('copy')+'</button></dd></div>'+
    '<div><dt>Seen on</dt><dd>'+seen.map(function(x){return '<span class="key">'+esc(x.url.replace('wss://',''))+'</span>'}).join('<span class="caption">·</span>')+'</dd></div>'+
    '<div><dt>Raw event</dt><dd style="display:block"><pre class="raw">'+esc(json)+'</pre></dd></div></dl>'+
    '<div class="btnrow" style="margin-top:16px"><button class="dk-btn dk-btn--secondary" data-act="copy" data-copy="'+esc(json)+'" data-msg="Copied raw event">'+ic('copy')+'Copy JSON</button></div>';
}

/* other sheets */
function openFeedAdd(){
  openSheet('<form class="sheet-stack" data-form="feed">'+head('Add a feed',true)+
    '<div class="dk-field"><label class="dk-field__label" for="feed-name">Name</label><input id="feed-name" placeholder="Morning reads" autofocus autocomplete="off"></div>'+
    '<div><div class="dk-field__label" style="margin-bottom:8px">Show notes from</div><div class="chipset" style="padding:0" role="radiogroup">'+Object.keys(SOURCES).map(function(k,i){return '<button type="button" class="dk-chip" role="radio" aria-checked="'+(i===0)+'" aria-selected="'+(i===0)+'" data-act="feed-src" data-v="'+k+'">'+SOURCES[k]+'</button>'}).join('')+'</div></div>'+
    '<div class="dk-field" id="feed-tag-field" hidden><label class="dk-field__label" for="feed-tag">Hashtag</label><input id="feed-tag" placeholder="#zaps" autocomplete="off"></div>'+
    '<button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">Add feed</button></form>',{label:'Add a feed'});
}
function openEditProfile(){
  var u=U.me;
  openSheet('<form class="sheet-stack" data-form="profile">'+head('Edit profile',true)+
    '<div class="photo-row">'+avatar('me','dk-avatar--lg')+'<div class="btnrow" style="flex:1"><button type="button" class="dk-btn dk-btn--secondary" data-act="photo-pick">'+ic('image')+(u.photo?'Change photo':'Add photo')+'</button>'+(u.photo?'<button type="button" class="dk-btn dk-btn--ghost" data-act="photo-remove">Remove</button>':'')+'</div></div>'+
    '<div class="dk-field"><label class="dk-field__label" for="pf-name">Display name</label><input id="pf-name" value="'+esc(u.name)+'"></div>'+
    '<div class="dk-field"><label class="dk-field__label" for="pf-about">About</label><textarea id="pf-about" rows="3">'+esc(u.about)+'</textarea></div>'+
    '<div class="dk-field"><label class="dk-field__label" for="pf-nip05">Verified address</label><input id="pf-nip05" value="'+esc(u.nip05)+'" autocomplete="off"><span class="dk-field__help">Looks like an email. Proves this account belongs to a website you control.</span></div>'+
    '<button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">Save</button></form>',{label:'Edit profile'});
}
function openMeMenu(){
  var u=U.me,onMe=(!wide()&&!S.stack.length&&S.tab==='me')||(S.stack.length&&S.stack[S.stack.length-1].type==='profile'&&S.stack[S.stack.length-1].id==='me');
  var opt=function(act,icon,tone,title,sub){return '<button class="option option--action" data-act="'+act+'"><span class="option__icon" style="background:var(--'+tone+');color:var(--on-accent)">'+ic(icon)+'</span><span><b>'+title+'</b><span>'+sub+'</span></span>'+ic('chev')+'</button>'};
  openSheet('<div class="me-head">'+avatar('me','dk-avatar--lg')+'<div style="min-width:0"><h2 class="dk-sheet__title" style="margin:0">'+esc(u.name)+'</h2><span class="verified">'+ic('verified','Verified')+esc(u.nip05)+'</span></div></div>'+
    '<div class="options">'+(onMe?'':opt('me-view','user','mist','View profile','See your notes, replies and bookmarks'))+
    opt('edit-profile','edit','lilac','Edit profile','Name, about and verified address')+opt('ident-open','wallet','sage','Switch identity',IDENT_ORDER.length+' identities in your wallet')+
    opt('photo-pick','image','peach',u.photo?'Change photo':'Add photo','Pick an image from this device')+
    (u.photo?opt('avatar-view-me','user','sage','View photo','See it full size'):'')+'</div>',{label:'Your profile'});
}
function openAvatarView(id){
  var u=U[id];
  openSheet('<div class="sheet-stack" style="justify-items:center;text-align:center;padding-block:8px">'+'<span class="dk-avatar avatar-xl" data-tone="'+u.tone+'" aria-hidden="true">'+avInner(u)+'</span><div><h2 class="dk-sheet__title" style="margin:0">'+esc(u.name)+'</h2><span class="caption">'+esc(u.nip05)+'</span></div>'+
    (id==='me'?'<button class="dk-btn dk-btn--secondary" data-act="photo-pick">'+ic('image')+'Change photo</button>':'<button class="dk-btn dk-btn--secondary" data-go="profile:'+id+'">View profile</button>')+'</div>',{label:'Photo'});
}
var fileTarget='compose';
function snapshotState(){return {follows:Array.from(S.follows),liked:Array.from(S.liked),bookmarks:Array.from(S.bookmarks),reposted:Array.from(S.reposted),zapped:S.zapped,muted:Array.from(S.muted),mutedWords:S.mutedWords,close:Array.from(S.close),notifs:NOTIFS,convs:CONVS}}
function switchIdentity(k){
  var cur=S.activeIdent;if(k===cur||!IDENT[k])return;
  IDENT[cur].state=snapshotState();IDENT[cur].signer=S.signer;
  var old=U.me;old.id=cur;U[cur]=old;
  var nu=U[k];delete U[k];nu.id='me';U.me=nu;
  Object.keys(N).forEach(function(i){if(N[i].author==='me')N[i].author=cur;else if(N[i].author===k)N[i].author='me'});
  REPOSTS.forEach(function(r){if(r.by==='me')r.by=cur;else if(r.by===k)r.by='me'});
  var st=IDENT[k].state||{};
  S.follows=new Set(st.follows||[]);S.liked=new Set(st.liked||[]);S.bookmarks=new Set(st.bookmarks||[]);S.reposted=new Set(st.reposted||[]);
  S.zapped=st.zapped||{};S.muted=new Set(st.muted||[]);S.mutedWords=st.mutedWords||[];S.close=new Set(st.close||[]);
  NOTIFS=st.notifs||[];CONVS=st.convs||{};
  S.signer=IDENT[k].signer;S.activeIdent=k;
  S.profileTab={};S.revealed=new Set();
  closeSheetNow();
  var keepWallet=S.stack.length&&S.stack[S.stack.length-1].type==='identities';
  S.stack=keepWallet?[{type:'identities',id:'all',pushed:true}]:[];
  render();toast('Now posting as '+U.me.name);
}
function openIdentMore(k){
  var u=identProfile(k),active=k===S.activeIdent;
  var opt=function(act,icon,tone,title,sub,danger){return '<button class="option option--action" data-act="'+act+'" data-id="'+k+'"><span class="option__icon" style="background:var(--'+tone+');color:var(--on-accent)">'+ic(icon)+'</span><span><b'+(danger?' style="color:var(--clay-ink)"':'')+'>'+title+'</b><span>'+sub+'</span></span>'+ic('chev')+'</button>'};
  openSheet('<div class="me-head"><span class="dk-avatar dk-avatar--lg" data-tone="'+u.tone+'" aria-hidden="true">'+avInner(u)+'</span><div style="min-width:0"><h2 class="dk-sheet__title" style="margin:0">'+esc(u.name)+'</h2><span class="caption">'+esc(u.nip05)+'</span></div></div><div class="options">'+
    (active?opt('edit-profile','edit','lilac','Edit profile','Name, photo and about'):opt('ident-switch','repost','sage','Switch to '+esc(u.name),'Post, like and message as this identity'))+
    opt('backup','lock','butter','Back up key','12 words that restore this identity')+
    opt('ident-copy','copy','mist','Copy public key',mid(u.npub,10,4))+
    (active?'<p class="caption" style="padding:4px 4px 0">Switch to another identity before removing this one.</p>':opt('ident-remove','trash','clay','Remove from this device','Your notes stay on Nostr',true))+
    '</div>',{label:'Identity options'});
}
function openIdentAdd(){
  var opt=function(m,icon,tone,title,sub){return '<button class="option option--action" data-act="ident-add-mode" data-v="'+m+'"><span class="option__icon" style="background:var(--'+tone+');color:var(--on-accent)">'+ic(icon)+'</span><span><b>'+title+'</b><span>'+sub+'</span></span>'+ic('chev')+'</button>'};
  openSheet(head('Add identity',true)+'<div class="options">'+
    opt('create','plus','mist','Create a new identity','A fresh key, generated on this device')+
    opt('bunker','key','sage','Connect a remote signer','Keep the key on another device')+
    opt('extension','server','lilac','Use a browser extension','Sign with an extension on this computer')+
    opt('nsec','warn','peach','Paste a private key','Least safe. Only on a device you trust')+'</div>',{label:'Add identity'});
}
function identAddForm(m){
  var back='<button class="dk-iconbtn" data-act="ident-add-back" aria-label="Back">'+ic('back')+'</button>';
  var title={create:'New identity',bunker:'Remote signer',extension:'Browser extension',nsec:'Private key'}[m];
  var field={
    create:'<div class="dk-field"><label class="dk-field__label" for="ia-name">Display name</label><input id="ia-name" placeholder="Side project" autocomplete="off" autofocus><span class="dk-field__help">You get 12 backup words after this.</span></div>',
    bunker:'<div class="dk-field" id="ia-field"><label class="dk-field__label" for="ia-key">Connection</label><input id="ia-key" class="key" placeholder="bunker://… or name@provider" autocomplete="off" spellcheck="false" autofocus><span class="dk-field__help" id="ia-help">Paste the connection from your signer app.</span></div>',
    extension:'<p class="sheet-text">Dusk will ask your extension for its public key. Approve the request in the extension to continue.</p>',
    nsec:'<div class="warn">'+ic('warn')+'<span>Anyone who sees this key can post as this identity. Dusk stores it encrypted on this device only.</span></div><div class="dk-field" id="ia-field"><label class="dk-field__label" for="ia-key">Private key</label><input id="ia-key" type="password" class="key" placeholder="nsec1…" autocomplete="off" autofocus><span class="dk-field__help" id="ia-help">Starts with nsec1.</span></div>'
  }[m];
  return '<div class="sheet-head">'+back+'<h2 class="dk-sheet__title">'+title+'</h2><span style="width:44px"></span></div><form class="sheet-stack" data-form="ident-add" data-mode="'+m+'">'+field+'<button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">'+(m==='create'?'Create identity':m==='extension'?'Connect extension':'Add identity')+'</button></form>';
}
var NEW_IDENT_TONES=['mist','sage','butter','rose','lilac','peach'];
function addIdentity(name,signer){
  var base=(name||'identity').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,12)||'identity',k=base,i=2;
  while(U[k]||IDENT[k]||k===U.me.handle){k=base+i;i++}
  U[k]={name:name,handle:k,nip05:'@'+k+' · not verified yet',verified:false,tone:NEW_IDENT_TONES[IDENT_ORDER.length%NEW_IDENT_TONES.length],about:'',following:0,followers:'0',isIdent:true,id:k,npub:'npub1'+rnd('npub'+k+Date.now(),58,B32),hex:rnd('hex'+k,64,HEX)};
  IDENT[k]={signer:signer,added:'Added just now',state:{follows:[],liked:[],bookmarks:[],reposted:[],zapped:{},muted:[],mutedWords:[],close:[],notifs:[],convs:{}}};
  IDENT_ORDER.push(k);return k;
}
var WORDS=['harbor','velvet','lantern','orbit','meadow','quiet','copper','tide','ember','willow','signal','dusk'];
function openBackup(){
  openSheet('<div class="sheet-stack">'+head('Back up your key',true)+
    '<p class="sheet-text">These 12 words restore your account on any device. Write them down and keep them somewhere safe. Anyone with them can post as you.</p>'+
    '<div class="words is-blur" id="words">'+WORDS.map(function(w){return '<span>'+w+'</span>'}).join('')+'</div>'+
    '<div class="btnrow"><button class="dk-btn dk-btn--secondary" data-act="reveal">'+ic('eyeoff')+'Reveal</button><button class="dk-btn dk-btn--secondary" data-act="copy" data-copy="'+WORDS.join(' ')+'" data-msg="Copied words">'+ic('copy')+'Copy</button></div></div>',{label:'Back up your key'});
}
function openSigner(){
  var opts=[['Remote signer','Keep your key on another device'],['Browser extension','Sign with an extension on this computer'],['Key on this device','Stored encrypted, unlocked with your passkey']];
  openSheet('<div class="sheet-stack">'+head('How you sign',true)+opts.map(function(o){return '<button class="option" role="radio" aria-checked="'+(S.signer===o[0])+'" data-act="signer-set" data-v="'+o[0]+'"><span class="option__icon">'+ic('key')+'</span><span><b>'+o[0]+'</b><span>'+o[1]+'</span></span></button>'}).join('')+'</div>',{label:'How you sign'});
}
function openNewDM(){
  var ppl=Array.from(S.follows);
  openSheet('<div class="sheet-stack">'+head('New message',true)+'<div class="group" style="border-radius:14px;overflow:hidden">'+ppl.map(function(id){return '<button class="person row-btn" data-act="dm" data-id="'+id+'">'+avatar(id)+'<span class="person__text"><b>'+esc(U[id].name)+'</b><span>'+esc(U[id].nip05)+'</span></span></button>'}).join('')+'</div></div>',{label:'New message'});
}
function openShortcuts(){
  var k=[['j / k','Next or previous note'],['l','Like'],['r','Reply'],['z','Zap'],['b','Bookmark'],['Enter','Open note'],['n','New note'],['/','Search'],['[ / ]','Previous or next feed'],['Esc','Close or go back']];
  openSheet('<div class="sheet-stack">'+head('Keyboard shortcuts',true)+'<div class="shortcuts">'+k.map(function(x){return '<span>'+x[0].split(' / ').map(function(s){return '<span class="kbd">'+esc(s)+'</span>'}).join(' ')+'</span><span>'+x[1]+'</span>'}).join('')+'</div></div>',{label:'Keyboard shortcuts'});
}
function openSyncSheet(){
  var s=S.settings,p=pendingCount();
  openSheet('<div class="sheet-stack">'+head(s.offline?'You\'re offline':'Sending',true)+
    '<p class="sheet-text">'+(s.offline?(p?p+plural(p,' note is',' notes are')+' saved on this device and will send when you reconnect.':'You can keep reading what\'s already loaded.'):'Your note is on its way to your servers.')+'</p>'+
    (s.offline?'<button class="dk-btn dk-btn--primary dk-btn--lg" data-act="go-online">Go back online</button>':'')+'</div>',{label:'Connection'});
}
function openMedia(id){
  var n=N[id];var m=n.media&&n.media.indexOf('data:')===0?null:MEDIA[n.media];
  var inner=!m?'<img src="'+n.media+'" alt="Attached image">':m.specimen?'<div class="specimen"><b>Hamburgefonstiv</b><span>Regular 13 · 16 · 34 px · open apertures</span></div>':'<div role="img" aria-label="'+esc(m.alt)+'" style="background:'+m.bg+'"></div>';
  openSheet('<div class="sheet-stack">'+head(U[n.author].name,true)+'<div class="media-full">'+inner+'</div><p class="caption">'+esc(m?m.alt:'Image')+'</p></div>',{label:'Image'});
}
function openProfileMore(uid){
  var u=U[uid],m=S.muted.has(uid);
  openSheet('<div class="sheet-head left"><h2 class="dk-sheet__title">'+esc(u.name)+'</h2></div><ul class="dk-menu">'+
    '<li><button class="dk-menu__item row-btn" data-act="copy" data-copy="'+u.npub+'" data-msg="Copied public key">'+ic('copy')+'Copy public key</button></li>'+
    '<li><button class="dk-menu__item row-btn" data-act="close-friend" data-id="'+uid+'">'+ic('like')+(S.close.has(uid)?'Remove from close friends':'Add to close friends')+'</button></li>'+
    '<li><button class="dk-menu__item dk-menu__item--danger row-btn" data-act="'+(m?'unmute':'note-mute-user')+'" data-id="'+uid+'">'+ic('mute')+(m?'Unmute':'Mute @'+handle(uid))+'</button></li></ul>',{label:'Profile options'});
}

/* ---------- refresh / incoming ---------- */
function addIncoming(){
  if(!S.pool.length)return null;
  var x=S.pool.shift(),id='i'+Date.now()+Math.floor(Math.random()*99);
  return mk(id,x.author,0,x.text,{media:x.media,l:Math.floor(Math.random()*20)});
}
function doRefresh(){
  var ind=$('.ptr',main);
  if(ind){ind.classList.remove('is-dragging');ind.style.height='44px';ind.firstChild.textContent='Checking for new notes'}
  setTimeout(function(){
    var got=[];S.incoming.forEach(function(n){got.push(n)});S.incoming=[];
    var n=addIncoming();if(n)got.push(n);
    Object.keys(N).forEach(function(k){if(N[k].t>=0&&got.indexOf(N[k])<0)N[k].t+=1});
    got.forEach(function(g){g.t=0;g.deleted=false;delete g.hidden;S.fresh.add(g.id)});
    render();
    var sc=$('.scroller',main);sc&&sc.scrollTo({top:0});
    toast(got.length?got.length+plural(got.length,' new note',' new notes'):'You\'re up to date');
  },800);
}
function wirePTR(sc){
  var ind=$('.ptr',sc);if(!ind)return;
  var y0=null,active=false,mouse=false;
  function start(y){if(sc.scrollTop>0)return;y0=y;active=true}
  function move(y){if(!active)return;var dy=y-y0;if(sc.scrollTop>0||dy<=0){ind.style.height='0px';return}
    var h=Math.min(72,dy*.5);ind.classList.add('is-dragging');ind.style.height=h+'px';ind.classList.toggle('is-armed',h>=56);ind.firstChild.textContent=h>=56?'Release to refresh':'Pull to refresh'}
  function end(){if(!active)return;active=false;ind.classList.remove('is-dragging');if(parseFloat(ind.style.height)>=56)doRefresh();else ind.style.height='0px';ind.classList.remove('is-armed')}
  sc.addEventListener('touchstart',function(e){start(e.touches[0].clientY)},{passive:true});
  sc.addEventListener('touchmove',function(e){move(e.touches[0].clientY)},{passive:true});
  sc.addEventListener('touchend',end);sc.addEventListener('touchcancel',end);
  sc.addEventListener('pointerdown',function(e){if(e.pointerType!=='mouse'||e.button)return;mouse=true;start(e.clientY)});
  window.addEventListener('pointermove',function(e){if(mouse&&e.pointerType==='mouse')move(e.clientY)});
  window.addEventListener('pointerup',function(e){if(mouse&&e.pointerType==='mouse'){mouse=false;end()}});
}
function wireFeedSwipe(bar){
  var x0=0,y0=0,id=null;
  bar.addEventListener('pointerdown',function(e){if(e.target.closest('button'))return;id=e.pointerId;x0=e.clientX;y0=e.clientY});
  bar.addEventListener('pointerup',function(e){if(e.pointerId!==id)return;id=null;var dx=e.clientX-x0,dy=e.clientY-y0;if(Math.abs(dx)>60&&Math.abs(dx)>2*Math.abs(dy))stepFeed(dx<0?1:-1)});
}
function stepFeed(d){var i=S.feeds.findIndex(function(f){return f.id===S.feed});var j=Math.max(0,Math.min(S.feeds.length-1,i+d));if(j!==i){S.feed=S.feeds[j].id;render();var c=$('.dk-chip[aria-selected="true"]',main);c&&c.scrollIntoView({inline:'center',block:'nearest'})}}
setInterval(function(){
  if(S.settings.offline||document.hidden)return;
  if(S.incoming.length>=3||!S.pool.length)return;
  var n=addIncoming();if(!n)return;n.deleted=true;n.hidden=true;S.incoming.push(n);
  if(S.tab==='home')render();
},40000);

/* edge swipe back (phones) */
(function(){
  var edge=null;
  main.addEventListener('pointerdown',function(e){
    if(wide()||!S.stack.length)return;
    var r=main.getBoundingClientRect();if(e.clientX-r.left>18)return;
    e.stopPropagation();edge={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0};try{main.setPointerCapture(e.pointerId)}catch(err){}
  },true);
  main.addEventListener('pointermove',function(e){if(!edge||e.pointerId!==edge.id)return;edge.dx=Math.max(0,e.clientX-edge.x);var s=$('.screen',main);if(s){s.style.transition='none';s.style.transform='translateX('+edge.dx+'px)'}});
  function end(e){if(!edge||e.pointerId!==edge.id)return;var dx=edge.dx;edge=null;var s=$('.screen',main);if(dx>90){suppressClick=true;pop()}else if(s){s.style.transition='transform 220ms cubic-bezier(0.22,0.8,0.24,1)';s.style.transform=''}}
  main.addEventListener('pointerup',end);main.addEventListener('pointercancel',end);
})();

/* ---------- long press ---------- */
var lp=null,suppressClick=false,down=null;
document.addEventListener('pointerdown',function(e){
  down={x:e.clientX,y:e.clientY};
  var note=e.target.closest('.dk-note');
  if(!note||e.target.closest('button,a,input,textarea')||e.button)return;
  var row=note.closest('[data-note]');if(!row||row.hasAttribute('data-preview'))return;
  lp={id:row.dataset.note,x:e.clientX,y:e.clientY,t:setTimeout(function(){
    if(!lp)return;suppressClick=true;try{navigator.vibrate&&navigator.vibrate(8)}catch(err){}
    var id=lp.id;lp=null;openNoteSheet(id);
  },480)};
},true);
document.addEventListener('pointermove',function(e){if(lp&&(Math.abs(e.clientX-lp.x)>8||Math.abs(e.clientY-lp.y)>8)){clearTimeout(lp.t);lp=null}},true);
['pointerup','pointercancel'].forEach(function(t){document.addEventListener(t,function(){if(lp){clearTimeout(lp.t);lp=null}},true)});
document.addEventListener('contextmenu',function(e){var row=e.target.closest('[data-note]');if(row&&!row.hasAttribute('data-preview')&&!e.target.closest('input,textarea')){e.preventDefault();openNoteSheet(row.dataset.note)}});

/* ---------- swipe actions ---------- */
document.addEventListener('dusk:action',function(e){
  var a=e.detail.action,t=e.target;
  var noteRow=t.closest('[data-note]');
  if(noteRow){
    if(noteRow.hasAttribute('data-preview')){toast('That swipe would '+ACT[a].label.toLowerCase()+' this note');return}
    noteAction(a,noteRow.dataset.note,'swipe');return;
  }
  var nr=t.closest('[data-notif]');
  if(nr){var x=NOTIFS.filter(function(n){return n.id===nr.dataset.notif})[0];if(a==='read'){x.unread=!x.unread;render()}else muteUser(x.who[0]);return}
  var cr=t.closest('[data-conv]');
  if(cr){var c=CONVS[cr.dataset.conv];
    if(a==='read'){c.unread=c.unread?0:1;render()}
    else{c.muted=true;render();toast('Muted conversation with '+first(c.with),function(){c.muted=false;render()})}
  }
});

/* ---------- clicks ---------- */
document.addEventListener('click',function(e){
  var t=e.target;
  if(suppressClick){suppressClick=false;e.preventDefault();e.stopPropagation();return}
  if(e.detail&&down&&(Math.abs(e.clientX-down.x)>10||Math.abs(e.clientY-down.y)>10)&&t.closest('.dk-swipe'))return;
  if(t.closest('[data-close]')){closeSheet();return}
  var tab=t.closest('[data-tab]');if(tab){closeSheetNow();setTab(tab.dataset.tab);return}
  var rd=t.closest('[data-read]');if(rd){NOTIFS.forEach(function(n){if(n.id===rd.dataset.read)n.unread=false})}
  var go=t.closest('[data-go]');if(go){e.preventDefault();goTo(go.dataset.go);return}
  var a=t.closest('[data-act]');if(a){act(a.dataset.act,a,e);return}
  var note=t.closest('.dk-note');
  if(note){var row=note.closest('[data-note]');if(!row||row.hasAttribute('data-preview')||note.classList.contains('is-focus'))return;
    var sw=note.closest('.dk-swipe');if(sw&&sw.style.getPropertyValue('--dk-x')&&parseFloat(sw.style.getPropertyValue('--dk-x'))!==0)return;
    goTo('thread:'+row.dataset.note)}
});
function act(k,el,e){
  var id=el.dataset.id,v=el.dataset.v,s=S.settings;
  switch(k){
    case 'back':pop();break;
    case 'close-side':S.stack=[];render();break;
    case 'like':case 'bookmark':case 'reply':case 'zap':case 'repost':noteAction(k,id,'button');break;
    case 'more':openNoteSheet(id);render();break;
    case 'cw':if(S.revealed.has(id))S.revealed.delete(id);else S.revealed.add(id);render();break;
    case 'compose':openCompose({});break;
    case 'feed':S.feed=id;if(el.hasAttribute('data-home')){S.tab='home';S.stack=[]}render();break;
    case 'feed-add':openFeedAdd();break;
    case 'refresh':doRefresh();break;
    case 'show-new':doRefresh();break;
    case 'follow':toggleFollow(id);break;
    case 'dm':closeSheetNow();openChatWith(id);break;
    case 'copy':copy(el.dataset.copy,el.dataset.msg);break;
    case 'set':setSetting(el.dataset.k,v);break;
    case 'markall':NOTIFS.forEach(function(n){n.unread=false});render();toast('All marked read');break;
    case 'filter':S.activityFilter=id;render();break;
    case 'ptab':S.profileTab[id]=v;render();break;
    case 'media':openMedia(id);break;
    case 'save-tag':var nid='tag-'+id;S.feeds.push({id:nid,name:'#'+id,src:'tag',tag:id});saveFeeds();render();toast('Added #'+id+' to your feeds');break;
    case 'edit-profile':openEditProfile();break;
    case 'backup':openBackup();break;
    case 'reveal':var w=$('#words');if(w){w.classList.toggle('is-blur');el.lastChild.textContent=w.classList.contains('is-blur')?'Reveal':'Hide'}break;
    case 'signer':openSigner();break;
    case 'signer-set':S.signer=v;closeSheet();render();toast('Signing with '+v.toLowerCase());break;
    case 'signout':openOnboarding();break;
    case 'onboarding':openOnboarding();break;
    case 'shortcuts':openShortcuts();break;
    case 'new-dm':openNewDM();break;
    case 'sync':openSyncSheet();break;
    case 'go-online':closeSheet();setOffline(false);break;
    case 'undo':if(undoFn){var f=undoFn;hideToast();f()}break;
    case 'unmute':S.muted.delete(id);closeSheetNow();render();toast('Unmuted @'+handle(id));break;
    case 'note-mute-user':closeSheet();muteUser(id);break;
    case 'close-friend':if(S.close.has(id))S.close.delete(id);else S.close.add(id);closeSheet();toast(S.close.has(id)?'Added to close friends':'Removed from close friends');break;
    case 'profile-more':openProfileMore(id);break;
    case 'word-del':S.mutedWords.splice(Number(id),1);render();break;
    case 'feed-up':case 'feed-down':var i=S.feeds.findIndex(function(f){return f.id===id}),j=k==='feed-up'?i-1:i+1;if(j>=0&&j<S.feeds.length){var tmp=S.feeds[i];S.feeds[i]=S.feeds[j];S.feeds[j]=tmp;saveFeeds();render();var b=$('[data-act="'+k+'"][data-id="'+id+'"]');b&&!b.disabled&&b.focus()}break;
    case 'feed-del':var gone=S.feeds.filter(function(f){return f.id===id})[0],gi=S.feeds.indexOf(gone);S.feeds.splice(gi,1);if(S.feed===id)S.feed=S.feeds[0].id;saveFeeds();render();toast('Removed '+gone.name,function(){S.feeds.splice(gi,0,gone);saveFeeds();render()});break;
    case 'feed-src':$$('[data-act="feed-src"]',layer).forEach(function(c){var on=c===el;c.setAttribute('aria-checked',on);c.setAttribute('aria-selected',on)});$('#feed-tag-field').hidden=v!=='tag';if(v==='tag')$('#feed-tag').focus();break;
    case 'server-flag':var sv=S.servers[Number(id)];sv[v]=!sv[v];render();break;
    case 'server-del':var rm=S.servers.splice(Number(id),1)[0],ri=Number(id);render();toast('Removed '+rm.url.replace('wss://',''),function(){S.servers.splice(ri,0,rm);render()});break;
    case 'wallet-demo':S.wallet.connected=true;afterWallet(el.hasAttribute('data-insheet'));break;
    case 'wallet-disconnect':S.wallet.connected=false;render();toast('Wallet disconnected');break;
    case 'zap-amt':if(v==='custom'){zapCtx.custom=true;zapCtx.amt=0}else{zapCtx.custom=false;zapCtx.amt=Number(v)}setSheet(zapView(zapCtx.id));if(zapCtx.custom)$('#zap-custom').focus();break;
    case 'zap-send':if(!zapCtx||!zapCtx.amt)return;var zid=zapCtx.id;if(zapNow(zid,zapCtx.amt,($('#zap-comment')||{}).value))closeSheet();break;
    case 'post':doPost();break;
    case 'attach':fileTarget='compose';$('#file').click();break;
    case 'me-menu':openMeMenu();break;
    case 'ident-open':closeSheetNow();goTo('identities:all');break;
    case 'ident-switch':switchIdentity(id);break;
    case 'ident-more':openIdentMore(id);break;
    case 'ident-copy':copy(identProfile(id).npub,'Copied public key');closeSheet();break;
    case 'ident-remove':setSheet('<div class="sheet-stack">'+head('Remove '+identProfile(id).name+'?',true)+'<p class="sheet-text">It disappears from this device. Its notes stay on Nostr, and you can add it back with its key or signer.</p><div class="btnrow"><button class="dk-btn dk-btn--secondary" data-close>Cancel</button><button class="dk-btn dk-btn--danger" data-act="ident-remove-yes" data-id="'+id+'">'+ic('trash')+'Remove</button></div></div>');break;
    case 'ident-remove-yes':var rmName=identProfile(id).name;IDENT_ORDER=IDENT_ORDER.filter(function(x){return x!==id});closeSheet();render();toast('Removed '+rmName);break;
    case 'ident-add':openIdentAdd();break;
    case 'ident-add-mode':setSheet(identAddForm(v));break;
    case 'ident-add-back':openIdentAdd();break;
    case 'me-view':closeSheetNow();if(wide())push({type:'profile',id:'me'});else{S.stack=[];setTab('me')}break;
    case 'avatar-view':openAvatarView(id);break;
    case 'avatar-view-me':openAvatarView('me');break;
    case 'photo-pick':fileTarget='avatar';$('#file').click();break;
    case 'photo-remove':delete U.me.photo;closeSheetNow();render();toast('Photo removed');break;
    case 'cw-toggle':if(compose){compose.cw=el.getAttribute('aria-pressed')==='true';$('#cw-field').hidden=!compose.cw;if(compose.cw)$('#cw-text').focus()}break;
    case 'mention':var ta=$('#compose-text');if(ta){var p=ta.selectionStart||ta.value.length;ta.value=ta.value.slice(0,p)+(p&&!/\s$/.test(ta.value.slice(0,p))?' @':'@')+ta.value.slice(p);ta.focus();updatePostBtn()}break;
    case 'attach-remove':if(compose){compose.media=null;$('#attach').innerHTML='';updatePostBtn()}break;
    case 'repost-do':closeSheet();toggleRepost(id);break;
    case 'quote':closeSheetNow();openCompose({quote:id});break;
    case 'note-copy':copy('nostr:nevent1'+rnd('nev'+id,60,B32),'Copied link');closeSheet();break;
    case 'note-text':copy(N[id].text,'Copied text');closeSheet();break;
    case 'note-bookmark':closeSheet();noteAction('bookmark',id);break;
    case 'note-mute':closeSheet();muteUser(N[id].author);break;
    case 'note-delete':setSheet('<div class="sheet-stack">'+head('Delete this note?',true)+'<p class="sheet-text">Dusk asks your servers to delete it. Servers that already shared it may keep a copy.</p><div class="btnrow"><button class="dk-btn dk-btn--secondary" data-act="details-back" data-id="'+id+'">Cancel</button><button class="dk-btn dk-btn--danger" data-act="note-delete-yes" data-id="'+id+'">'+ic('trash')+'Delete</button></div></div>');break;
    case 'note-delete-yes':N[id].deleted=true;closeSheet();var top=S.stack[S.stack.length-1];if(top&&top.type==='thread'&&top.id===id)S.stack.pop();render();toast('Note deleted');break;
    case 'details':setSheet(detailsHTML(id));break;
    case 'details-back':setSheet(noteSheetHTML(id));break;
  }
}
function openChatWith(uid){
  var k=Object.keys(CONVS).filter(function(c){return CONVS[c].with===uid})[0];
  if(!k){k='c'+Date.now();CONVS[k]={with:uid,unread:0,msgs:[]}}
  CONVS[k].muted=false;
  if(!wide()){S.tab='messages';S.stack=[]}
  goTo('chat:'+k);
}
function afterWallet(inSheet){
  render();
  if(inSheet&&zapCtx){zapCtx.amt=S.wallet.defaultZap;setSheet(zapView(zapCtx.id))}
  else{closeSheet()}
  toast('Wallet connected');
}
function setSetting(k,v){
  var s=S.settings;
  if(k==='defaultZap'){S.wallet.defaultZap=Number(v);render();return}
  s[k]=v;saveSettings();applySettings();render();
}
function setOffline(off){
  S.settings.offline=off;saveSettings();
  if(!off){var p=Object.keys(N).filter(function(k){return N[k].pending});Object.keys(CONVS).forEach(function(c){CONVS[c].msgs.forEach(function(m){if(m.pending){m.pending=false;m.t=0}})});
    if(p.length){p.forEach(function(k){N[k].pending=false});S.syncing=true;render();setTimeout(function(){S.syncing=false;render()},900);toast('Sent '+p.length+plural(p.length,' note',' notes'));return}
    render();toast('Back online');return}
  render();toast('You\'re offline. Notes will wait on this device.');
}

/* ---------- inputs & forms ---------- */
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.dataset.toggle){
    var k=t.dataset.toggle,on=t.checked;
    if(k==='offline'){setOffline(on);return}
    if(k.indexOf('notif.')===0){S.settings.notif[k.slice(6)]=on;saveSettings();render();return}
    if(k==='wallet.oneTap'){S.wallet.oneTap=on;render();return}
    S.settings[k]=on;if(k==='advanced'&&!on&&S.settings.offline)S.settings.offline=false;saveSettings();render();return;
  }
  if(t.dataset.feedname){var f=feedById(t.dataset.feedname),nv=t.value.trim();if(nv&&nv!==f.name){f.name=nv;saveFeeds();toast('Renamed to '+nv)}else t.value=f.name;return}
  if(t.id==='file'){
    var file=t.files&&t.files[0];t.value='';if(!file)return;
    if(fileTarget==='avatar'){var ra=new FileReader();ra.onload=function(){U.me.photo=ra.result;closeSheetNow();render();toast('Photo updated')};ra.readAsDataURL(file);return}
    if(!compose)return;
    var r=new FileReader();r.onload=function(){if(!compose)return;compose.media=r.result;var at=$('#attach');at.innerHTML='<div class="attach"><img src="'+r.result+'" alt="Image to attach"><button class="dk-iconbtn" data-act="attach-remove" aria-label="Remove image">'+ic('close')+'</button></div>';updatePostBtn()};r.readAsDataURL(file);
  }
});
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.id==='q'){S.searchQ=t.value;refreshSearch();return}
  if(t.id==='compose-text'){updatePostBtn();if(compose&&!compose.replyTo&&!compose.quote)store.set('draft',t.value);return}
  if(t.id==='zap-custom'){var n=parseInt(t.value.replace(/\D/g,''),10)||0;zapCtx.amt=n;var b=$('#zap-send');b.disabled=!n;b.lastChild.textContent='Zap '+(n?sats(n)+' sats':'');return}
  if(t.id==='chat-input'){t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'}
});
function refreshSearch(){var box=$('#search-results');if(box){box.innerHTML=searchResults(S.searchQ);Dusk.mount(box)}}
document.addEventListener('submit',function(e){
  var f=e.target,kind=f.dataset.form;if(!kind)return;e.preventDefault();
  if(kind==='chat'){var ta=$('#chat-input',f),x=ta.value.trim();if(!x)return;var c=CONVS[f.dataset.id];c.msgs.push({f:'me',x:x,t:0,pending:S.settings.offline});ta.value='';render();var ni=$('#chat-input');ni&&ni.focus();
    if(!S.settings.offline&&c.with==='jun'&&!c.replied){c.replied=true;setTimeout(function(){c.msgs.push({f:'jun',x:'Nice. Syncing looks fine from here too.',t:0});var top=S.stack[S.stack.length-1];if(!top||top.id!==f.dataset.id)c.unread=1;render()},2200)}return}
  if(kind==='ctxsearch'){var q=$('#ctx-q').value;S.searchQ=q;S.tab='search';render();var qi=$('#q');qi&&qi.focus();return}
  if(kind==='word'){var wi=$('#word-input'),w=wi.value.trim().replace(/^#/,'');if(!w)return;if(S.mutedWords.indexOf(w)<0)S.mutedWords.push(w);render();var wn=$('#word-input');wn&&wn.focus();toast('Muted “'+w+'”');return}
  if(kind==='server'){var si=$('#server-input'),url=si.value.trim();var fld=$('#server-field'),help=$('#server-help');
    if(!/^wss?:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)){fld.classList.add('dk-field--error');help.hidden=false;help.textContent='Use an address that starts with wss://, like wss://relay.example.com';si.focus();return}
    S.servers.push({url:url,read:true,write:true,status:'ok',ms:120+Math.floor(Math.random()*200)});render();toast('Added '+url.replace(/^wss?:\/\//,''));return}
  if(kind==='feed'){var name=$('#feed-name').value.trim(),src=($('[data-act="feed-src"][aria-checked="true"]',layer)||{dataset:{v:'following'}}).dataset.v,tag=($('#feed-tag').value||'').trim().replace(/^#/,'').toLowerCase();
    if(src==='tag'&&!tag){$('#feed-tag').focus();return}
    var nf={id:'f'+Date.now(),name:name||(src==='tag'?'#'+tag:SOURCES[src]),src:src,tag:src==='tag'?tag:undefined};S.feeds.push(nf);S.feed=nf.id;saveFeeds();closeSheet();S.tab='home';if(!wide())S.stack=[];render();toast('Added '+nf.name);return}
  if(kind==='profile'){U.me.name=$('#pf-name').value.trim()||U.me.name;U.me.about=$('#pf-about').value.trim();U.me.nip05=$('#pf-nip05').value.trim()||U.me.nip05;closeSheet();render();toast('Profile saved');return}
  if(kind==='wallet'){var nwc=$('#nwc').value.trim(),fl=$('#nwc-field'),hp=$('#nwc-help');
    if(nwc.indexOf('nostr+walletconnect://')!==0){fl.classList.add('dk-field--error');hp.textContent='That doesn\'t look like a connection string. It starts with nostr+walletconnect://';$('#nwc').focus();return}
    S.wallet.connected=true;afterWallet(f.hasAttribute('data-insheet'));return}
  if(kind==='ident-add'){
    var m=f.dataset.mode,k,name;
    if(m==='create'){name=$('#ia-name').value.trim();if(!name){$('#ia-name').focus();return}k=addIdentity(name,'Key on this device');closeSheetNow();render();openBackup();toast('Created '+name);return}
    if(m==='extension'){k=addIdentity('Extension key','Browser extension');closeSheet();render();toast('Added identity from your extension');return}
    var inp=$('#ia-key'),val=inp.value.trim(),ok=m==='bunker'?(/^bunker:\/\//.test(val)||/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(val)):/^nsec1[0-9a-z]{20,}$/.test(val);
    if(!ok){$('#ia-field').classList.add('dk-field--error');$('#ia-help').textContent=m==='bunker'?'Paste a bunker:// connection or an address like name@provider.com':'That isn\'t a private key. It starts with nsec1.';inp.focus();return}
    name=m==='bunker'?(val.indexOf('@')>0&&val.indexOf('bunker')!==0?val.split('@')[0]:'Remote key'):'Imported key';
    k=addIdentity(name,m==='bunker'?'Remote signer':'Key on this device');closeSheet();render();toast('Added '+name);return}
  if(kind&&kind.indexOf('onb')===0){onbSubmit(kind,f);return}
});
document.addEventListener('keydown',function(e){
  var t=e.target,typing=t.matches&&t.matches('input,textarea');
  if(t.id==='compose-text'&&e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();doPost();return}
  if(t.id==='chat-input'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();var form=t.closest('form');form&&form.requestSubmit?form.requestSubmit():form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));return}
  if(e.key==='Escape'){if(sheetState){closeSheet();return}if(!$('#onb').hidden)return;if(S.stack.length){pop();return}if(typing)t.blur();return}
  if(typing||e.metaKey||e.ctrlKey||e.altKey||sheetState||!$('#onb').hidden)return;
  var notes=$$('.dk-note').filter(function(n){return n.offsetParent&&!n.closest('[data-preview]')});
  var cur=document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains('dk-note')?document.activeElement:null;
  var idx=notes.indexOf(cur);
  var curId=cur&&cur.closest('[data-note]').dataset.note;
  switch(e.key){
    case 'j':case 'k':e.preventDefault();var n=notes[Math.max(0,Math.min(notes.length-1,idx<0?0:idx+(e.key==='j'?1:-1)))];n&&(n.focus(),n.scrollIntoView({block:'nearest'}));break;
    case 'l':case 'r':case 'z':case 'b':if(curId){e.preventDefault();noteAction({l:'like',r:'reply',z:'zap',b:'bookmark'}[e.key],curId,'key')}break;
    case 'Enter':if(cur&&t===cur){e.preventDefault();goTo('thread:'+curId)}break;
    case 'n':e.preventDefault();openCompose({});break;
    case '/':e.preventDefault();if(wide()&&$('#ctx-q')){$('#ctx-q').focus()}else setTab('search');break;
    case '[':stepFeed(-1);break;case ']':stepFeed(1);break;
    case '?':openShortcuts();break;
  }
});

/* ---------- onboarding ---------- */
var onb=null,onbEl=$('#onb');
function openOnboarding(){closeSheetNow();onb={step:'welcome',follows:new Set(['ada','mira','noor']),signin:'Remote signer',saved:false};renderOnb()}
function renderOnb(){
  if(!onb){onbEl.hidden=true;onbEl.innerHTML='';return}
  onbEl.hidden=false;var h='';
  if(onb.step==='welcome'){
    h='<div class="horizon" aria-hidden="true"><i style="bottom:24%"></i><i style="bottom:14%;left:24%;right:24%"></i></div>'+
      '<h1>Quiet by default</h1><p class="lead">Dusk is a calm way to read and post on Nostr. No email, no phone number. Your account is a key you hold.</p>'+
      '<button class="dk-btn dk-btn--primary dk-btn--lg" data-onb="name">Create an account</button><button class="dk-btn dk-btn--secondary dk-btn--lg" data-onb="signin">I already have one</button>';
  }else if(onb.step==='name'){
    h='<span class="onb__step">Step 1 of 3</span><h1>What should people call you?</h1><form class="sheet-stack" data-form="onb-name"><div class="dk-field"><label class="dk-field__label" for="onb-name">Display name</label><input id="onb-name" autocomplete="name" placeholder="Tolga" value="'+esc(onb.name||'')+'" autofocus></div><div class="dk-field"><label class="dk-field__label" for="onb-about">About you <span class="caption">(optional)</span></label><textarea id="onb-about" rows="2" placeholder="A line or two"></textarea></div><button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">Continue</button></form><button class="dk-btn dk-btn--ghost" data-onb="welcome">Back</button>';
  }else if(onb.step==='backup'){
    h='<span class="onb__step">Step 2 of 3</span><h1>Your key, in 12 words</h1><p class="lead">These words are your account. If you lose this device, they bring everything back. Nobody, including Dusk, can reset them.</p>'+
      '<div class="words">'+WORDS.map(function(w){return '<span>'+w+'</span>'}).join('')+'</div>'+
      '<button class="dk-btn dk-btn--secondary" data-act="copy" data-copy="'+WORDS.join(' ')+'" data-msg="Copied words">'+ic('copy')+'Copy words</button>'+
      '<label class="check"><input type="checkbox" id="onb-saved"'+(onb.saved?' checked':'')+'> I wrote them down somewhere safe</label>'+
      '<button class="dk-btn dk-btn--primary dk-btn--lg" data-onb="follows" id="onb-next"'+(onb.saved?'':' disabled')+'>Continue</button><button class="dk-btn dk-btn--ghost" data-onb="follows">Remind me later</button>';
  }else if(onb.step==='follows'){
    h='<span class="onb__step">Step 3 of 3</span><h1>Pick a few people to start</h1><p class="lead">You can change this any time. Your home feed shows notes from people you follow.</p>'+
      '<div class="group" style="border-radius:14px;overflow:hidden">'+['ada','jun','mira','sol','noor','theo'].map(function(id){var on=onb.follows.has(id);return '<div class="person">'+avatar(id)+'<span class="person__text"><b>'+esc(U[id].name)+'</b><span>'+esc(U[id].about)+'</span></span><button class="dk-btn '+(on?'dk-btn--secondary':'dk-btn--primary')+' dk-btn--sm" data-onbfollow="'+id+'" aria-pressed="'+on+'">'+(on?'Following':'Follow')+'</button></div>'}).join('')+'</div>'+
      '<button class="dk-btn dk-btn--primary dk-btn--lg" data-onb="done">Start reading</button>';
  }else if(onb.step==='signin'){
    var opts=[['Remote signer','Keep your key on another device. Safest on phones.','key'],['Browser extension','Sign with an extension on this computer.','server'],['Paste your private key','Least safe. Only on a device you trust.','warn']];
    h='<h1>Sign in</h1><p class="lead">Choose how Dusk should sign your notes.</p>'+
      opts.map(function(o){return '<button class="option" role="radio" aria-checked="'+(onb.signin===o[0])+'" data-onbsign="'+o[0]+'"><span class="option__icon">'+ic(o[2])+'</span><span><b>'+o[0]+'</b><span>'+o[1]+'</span></span></button>'}).join('')+
      '<form class="sheet-stack" data-form="onb-signin">'+
      (onb.signin==='Remote signer'?'<div class="dk-field" id="onb-key-field"><label class="dk-field__label" for="onb-key">Connection</label><input id="onb-key" class="key" placeholder="bunker://… or name@provider" autocomplete="off" spellcheck="false"><span class="dk-field__help" id="onb-key-help">Paste the connection from your signer app.</span></div>':
       onb.signin==='Paste your private key'?'<div class="warn">'+ic('warn')+'<span>Anyone who sees this key can post as you. Dusk stores it encrypted on this device only.</span></div><div class="dk-field" id="onb-key-field"><label class="dk-field__label" for="onb-key">Private key</label><input id="onb-key" type="password" class="key" placeholder="nsec1…" autocomplete="off"><span class="dk-field__help" id="onb-key-help">Starts with nsec1.</span></div>':
       '<p class="caption">Dusk will ask your extension for permission.</p>')+
      '<button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">Continue</button></form><button class="dk-btn dk-btn--ghost" data-onb="welcome">Back</button>';
  }
  onbEl.innerHTML='<div class="onb">'+h+'</div>';Dusk.mount(onbEl);
  var f=$('[autofocus]',onbEl)||$('button',onbEl);f&&f.focus({preventScroll:true});
}
function onbSubmit(kind,f){
  if(kind==='onb-name'){var n=$('#onb-name').value.trim();if(!n){$('#onb-name').focus();return}onb.name=n;onb.about=$('#onb-about').value.trim();onb.step='backup';renderOnb();return}
  if(kind==='onb-signin'){
    var inp=$('#onb-key');
    if(inp){var v=inp.value.trim(),ok=onb.signin==='Remote signer'?(/^bunker:\/\//.test(v)||/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)):/^nsec1[0-9a-z]{20,}$/.test(v);
      if(!ok){$('#onb-key-field').classList.add('dk-field--error');$('#onb-key-help').textContent=onb.signin==='Remote signer'?'Paste a bunker:// connection or an address like name@provider.com':'That isn\'t a private key. It starts with nsec1.';inp.focus();return}}
    S.signer=onb.signin==='Paste your private key'?'Key on this device':onb.signin;onb=null;renderOnb();render();toast('Signed in');return}
}
onbEl.addEventListener('click',function(e){
  var b=e.target.closest('[data-onb]');
  if(b){var st=b.dataset.onb;
    if(st==='done'){U.me.name=onb.name||U.me.name;if(onb.about)U.me.about=onb.about;S.follows=new Set(Array.from(onb.follows).concat(['kit']));onb=null;renderOnb();S.tab='home';S.stack=[];render();toast('Welcome to Dusk');return}
    onb.step=st;renderOnb();return}
  var fb=e.target.closest('[data-onbfollow]');if(fb){var id=fb.dataset.onbfollow;if(onb.follows.has(id))onb.follows.delete(id);else onb.follows.add(id);renderOnb();var nb=$('[data-onbfollow="'+id+'"]',onbEl);nb&&nb.focus();return}
  var sb=e.target.closest('[data-onbsign]');if(sb){onb.signin=sb.dataset.onbsign;renderOnb();var k=$('#onb-key');k&&k.focus();return}
});
onbEl.addEventListener('change',function(e){if(e.target.id==='onb-saved'){onb.saved=e.target.checked;$('#onb-next').disabled=!onb.saved}});

/* ---------- moving, stretchy highlight ---------- */
var slideMemo={},reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
function placeSliders(){
  slide(rail,'.rail__item[aria-current="page"]','y','rail');
  $$('.dk-tabbar').forEach(function(tb){slide(tb,'.dk-tab[aria-selected="true"] .dk-tab__pill','x','tabbar')});
  $$('.dk-chips[role="tablist"]').forEach(function(c){slide(c,'.dk-chip[aria-selected="true"]','x','chips:'+c.getAttribute('aria-label'))});
}
function slide(box,sel,axis,key){
  if(!box)return;
  var br=box.getBoundingClientRect();if(!br.width||!br.height)return;
  var el=box.querySelector(sel);if(!el){delete slideMemo[key];return}
  var r=el.getBoundingClientRect();
  var t={x:r.left-br.left+box.scrollLeft,y:r.top-br.top+box.scrollTop,w:r.width,h:r.height};
  var sl=document.createElement('div');sl.className='slider';sl.setAttribute('aria-hidden','true');box.insertBefore(sl,box.firstChild);
  var css=function(o){return {left:o.x+'px',top:o.y+'px',width:o.w+'px',height:o.h+'px'}};
  Object.assign(sl.style,css(t));
  var p=slideMemo[key];slideMemo[key]=t;
  if(!p||reduceMotion.matches||(Math.abs(p.x-t.x)<1&&Math.abs(p.y-t.y)<1)||!sl.animate)return;
  var item=el.closest('.dk-tab,.dk-chip');if(item){item.classList.add('is-pending');setTimeout(function(){item.classList.remove('is-pending')},300)}
  var P=axis==='x'?'x':'y',Z=axis==='x'?'w':'h',C=axis==='x'?'y':'x',CZ=axis==='x'?'h':'w';
  var fw=t[P]>p[P],cp=function(o){return {x:o.x,y:o.y,w:o.w,h:o.h}};
  // 1) leading edge reaches the target while the trailing edge stays put: a long stretch
  var st=cp(t);
  if(fw){st[P]=p[P];st[Z]=t[P]+t[Z]-p[P]}else{st[P]=t[P];st[Z]=p[P]+p[Z]-t[P]}
  st[C]=(p[C]+t[C])/2;st[CZ]=(p[CZ]+t[CZ])/2;
  // 2) trailing edge snaps in and overshoots (squash), 3) small rebound
  var a=Math.min(10,t[Z]*.22),o1=cp(t),o2=cp(t);
  if(fw){o1[P]=t[P]+a;o1[Z]=t[Z]-a;o2[P]=t[P]-a*.35;o2[Z]=t[Z]+a*.35}
  else{o1[Z]=t[Z]-a;o2[Z]=t[Z]+a*.35}
  var sc=function(v){return axis==='x'?'scaleY('+v+')':'scaleX('+v+')'};
  var f=function(o,s,off,ease){var k=css(o);k.transform=sc(s);k.offset=off;if(ease)k.easing=ease;return k};
  sl.animate([
    f(p,1,0,'cubic-bezier(.55,0,.9,.4)'),
    f(st,.8,.46,'cubic-bezier(.2,.75,.35,1)'),
    f(o1,1.08,.72,'ease-in-out'),
    f(o2,.97,.88,'ease-out'),
    f(t,1,1)
  ],{duration:600});
}
var resizeT=null;
window.addEventListener('resize',function(){clearTimeout(resizeT);resizeT=setTimeout(function(){slideMemo={};$$('.slider').forEach(function(x){x.remove()});placeSliders()},120)});


/* =====================================================================
   Extensions: reactions, rich content, media, composer helpers, profile,
   NIP-51 lists, private messages, safety, signers, push, PWA, a11y, extras
   ===================================================================== */
Object.assign(EXTRA,{
  smile:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 10h.01M15 10h.01",
  globe:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
  link:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  calendar:"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  play:"M8 5v14l11-7z", pause:"M8 5h3v14H8zM13 5h3v14h-3z",
  poll:"M5 20V10M12 20V4M19 20v-7",
  shield:"M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z",
  flag:"M5 21V4M5 4h11l-2 4 2 4H5",
  qr:"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM16 16h2v2h-2z",
  text:"M4 7V5h16v2M12 5v14M9 19h6",
  contrast:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18",
  phone:"M8 3h8v18H8zM11 18h2",
  bolt:"M13 3 5 13.5h6L10 21l8-10.5h-6l1-7.5z",
  inbox:"M4 13l2.5-8h11l2.5 8v6H4zM4 13h5l1 2h4l1-2h5",
  download:"M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14",
  badge:"M12 3l7 4v10l-7 4-7-4V7z",
  vanish:"M4 12c2-4 5-6 8-6s6 2 8 6M7 16c1.5-2 3-3 5-3s3.5 1 5 3M10 20h4",
  stream:"M3 6h18v12H3zM10 9.5v5l4-2.5z",
  bell2:"M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  share2:"M12 4v11M7.5 8.5 12 4l4.5 4.5M5 14v5.5h14V14",
  image2:"M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9h.01"
});

/* ---------- extra sample data ---------- */
function svgURI(inner){return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'+inner+'</svg>')}
var CUSTOM={
  dusk:svgURI('<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcaedb"/><stop offset=".6" stop-color="#efb99c"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="url(#g)"/><circle cx="16" cy="17" r="6" fill="#e8d49b"/><rect x="1" y="19" width="30" height="13" fill="#9cc6c2"/>'),
  sats:svgURI('<circle cx="16" cy="16" r="15" fill="#efb99c"/><path d="M17.5 6 10 18h5l-1.5 8L22 14h-5z" fill="#14151a"/>'),
  relay:svgURI('<circle cx="16" cy="16" r="15" fill="#9cc6c2"/><path d="M16 12v14M11 26h10M10 9a8 8 0 0 1 12 0M12.5 11.5a4.5 4.5 0 0 1 7 0" stroke="#14151a" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="16" cy="13" r="2" fill="#14151a"/>'),
  calm:svgURI('<circle cx="16" cy="16" r="15" fill="#bcaedb"/><path d="M20 8a9 9 0 1 0 4 12A7 7 0 0 1 20 8z" fill="#14151a"/>'),
  tomato:svgURI('<circle cx="16" cy="18" r="12" fill="#ec9886"/><path d="M11 7l5 4 5-4-2 6h-6z" fill="#acc99e"/>')
};
var EMOJI=[['❤️','heart love'],['🔥','fire'],['😂','joy laugh'],['👀','eyes'],['🙏','pray thanks'],['👍','thumbs up yes'],['🤙','shaka'],['⚡','zap lightning'],['🎉','party'],['😮','wow surprised'],['😢','sad cry'],['🤔','thinking'],['💯','hundred'],['🌊','wave sea'],['☕','coffee'],['🌱','plant grow'],['🚲','bike'],['📷','camera photo'],['✨','sparkles'],['🫡','salute'],['💜','purple heart'],['🍅','tomato'],['🌅','sunrise'],['👏','clap'],['😊','smile'],['🥲','smile tear'],['🙌','hands'],['💡','idea'],['🧡','orange heart'],['🌙','moon']];
function emo(e){if(e&&e[0]===':'){var k=e.slice(1,-1);if(CUSTOM[k])return '<img class="cemoji" src="'+CUSTOM[k]+'" alt="'+esc(e)+'">'}return esc(e)}
function NEV(id){return 'nevent1'+rnd('nev'+id,58,B32)}
function NADDR(a){return 'naddr1'+rnd('naddr'+a,70,B32)}

U.satsdrop={name:'Sats Drop',handle:'satsdrop',nip05:'',verified:false,tone:'butter',about:'Daily giveaways!!',following:4800,followers:'12',outside:true};
U.promo={name:'Moon Signals',handle:'promo',nip05:'',verified:false,tone:'peach',about:'Calls that print.',following:3100,followers:'40',outside:true};
['satsdrop','promo'].forEach(function(k){U[k].id=k;U[k].npub='npub1'+rnd('npub'+k,58,B32);U[k].hex=rnd('hex'+k,64,HEX)});
U.me.website='dusk.social';U.me.lud16='tolga@sats.dusk.social';
U.ada.website='wren.ink';U.ada.lud16='ada@wren.ink';U.jun.website='relaywork.net';U.jun.lud16='jun@relaywork.net';
U.mira.website='longform.club';U.noor.website='amari.studio';U.sol.lud16='sol@sol.garden';
U.lena.nip05Failed=true;
U.ada.banner='tide';U.theo.banner='fog';U.jun.banner='dusk';

var BADGES={
  early:{name:'Early Dusk tester',desc:'Tried Dusk before version 1.0 and sent feedback.',issuer:'dusk',tone:'lilac',glyph:'D'},
  meetup:{name:'Utrecht meetup 2026',desc:'Came to the Nostr meetup in Utrecht.',issuer:'pieter',tone:'sage',glyph:'U'},
  relayop:{name:'Relay operator',desc:'Runs a public relay that others can use.',issuer:'jun',tone:'peach',glyph:'R'},
  photo:{name:'Photo walk',desc:'Joined a #photography walk.',issuer:'theo',tone:'rose',glyph:'P'}
};
var USER_BADGES={me:[{b:'early',ok:true},{b:'meetup',ok:false}],jun:[{b:'relayop',ok:true},{b:'early',ok:true}],ada:[{b:'early',ok:true},{b:'photo',ok:true}],theo:[{b:'photo',ok:true}],pieter:[{b:'meetup',ok:true}]};

var LINKS={
  'https://quietcafes.map/nl':{site:'quietcafes.map',title:'Quiet cafes with power outlets',desc:'A short, honest map of places to work in peace.',bg:'linear-gradient(135deg,#d9c3a5,#8a6446)'},
  'https://amari.studio/notes/small-screens':{site:'amari.studio',title:'Designing a typeface for 13 pixels',desc:'Spacing, apertures, and the letters that broke first.',bg:'linear-gradient(135deg,#efe0aa,#c9b27a)'}
};

function addReacts(id,r){N[id].reacts=r}
mk('n20','kit',110,'Two reads I keep sending to new client devs: nostr:'+NADDR('a1')+' and this older note from Mira nostr:'+NEV('n10'),{r:6,l:44});
mk('n21','rafa',210,'Coffee with nostr:'+U.pieter.npub+' today. He showed me the quiet-cafe map: https://quietcafes.map/nl :calm:',{r:3,l:51});
mk('n22','noor',520,'Wrote up the spacing decisions behind the new face: https://amari.studio/notes/small-screens #typography',{r:19,l:132,z:600});
mk('n23','theo',140,'Morning fog rolling over the polder, timelapse. #photography',{r:11,l:154,z:900});
N.n23.video={poster:'fog',dur:'0:42',alt:'Timelapse of fog drifting over flat fields at sunrise'};
mk('n24','ada',330,'Three tides this week. #photography',{r:14,l:260,z:2600});
N.n24.gallery=[{m:'tide',alt:'Low tide reflecting the sky'},{m:'dusk',alt:'The sea at dusk under a violet sky'},{m:'fog',alt:'Fog over the dunes'}];
mk('n25','kit',170,'Which signer do you use day to day? #nostrdev',{r:4,l:28});
N.n25.poll={options:['Browser extension','Remote signer (bunker)','Amber on Android','Key in the app'],votes:[120,88,64,40],multi:false,ends:2880};
mk('n26','jun',6,'Live now: building a relay from scratch, part 3. Questions welcome. #relay',{r:8,l:73,z:4100});
N.n26.live={title:'Relay from scratch, part 3',viewers:214};
mk('n27','pieter',260,'Small Nostr meetup next week, everyone welcome. Bring a laptop if you want help setting up keys.',{r:9,l:61});
N.n27.event={title:'Nostr meetup Utrecht',day:'23',mon:'Oct',when:'Thursday 23 October · 19:00 to 21:30',where:'Café Stil, Utrecht',going:18,maybe:7};
mk('r12','satsdrop',2,'Congrats! You were picked for a 50,000 sats giveaway. DM me your wallet to claim',{parent:'n1'});
mk('r13','promo',5,'Nice pic. Check my profile for signals that 10x',{parent:'n1'});
mk('r14','promo',100,'Great question. My signals group answers this',{parent:'n7'});
addReacts('n1',{'🔥':{c:12,who:['jun','noor']},'🌊':{c:8,who:['sol']},':calm:':{c:3,who:['mira']}});
addReacts('n2',{'⚡':{c:20,who:['kit','sol']},'🤙':{c:6,who:['noor']}});
addReacts('n9',{'🙏':{c:40,who:['sol','noor','kit']},'💜':{c:12,who:['mira']}});
addReacts('n10',{'💯':{c:33,who:['ada','kit']}});
addReacts('m1',{':dusk:':{c:9,who:['ada','kit','noor']},'🔥':{c:5,who:['jun']}});
addReacts('n24',{'😮':{c:22,who:['theo','rafa']},'📷':{c:7,who:['theo']}});
NOTIFS.unshift({id:'x9',kind:'reply',who:['satsdrop'],note:'r12',t:2,unread:true});
CONVS.c5={with:'satsdrop',request:true,unread:1,msgs:[{f:'satsdrop',x:'Hi! You won 50,000 sats. Send your wallet seed to claim it today.',t:30}]};
CONVS.c6={with:'theo',request:true,unread:1,msgs:[{f:'theo',x:'Hey, loved your swipe demo. Could my photo club use Dusk for our walks?',t:95}]};
var LIVECHAT=[{f:'kit',x:'How do you handle backpressure on slow subscribers?'},{f:'sol',x:'Watching from the garden ☕'},{f:'noor',x:'The log viewer looks great'},{f:'ada',x:'Hi all'}];
var LIVECHAT_POOL=[{f:'rafa',x:'Just joined, what did I miss?'},{f:'mira',x:'This is a good pace for a tutorial'},{f:'kit',x:'Negentropy next week?'},{f:'theo',x:'👀'},{f:'pieter',x:'Will this be recorded?'},{f:'sol',z:500,x:'For the coffee fund'}];

/* extra state */
S.myReacts={};S.loaded=new Set();S.blurDone=new Set();S.playing=new Set();S.votes={};S.rsvp={};S.mutedThreads=new Set();S.reported=new Set();S.showHidden=new Set();
S.drafts=store.get('drafts',[{id:'d'+1,text:'Half-written thought about calm notification design: what if every app had to justify each ping',t:Date.now()-3600e3}]);
S.mediaServers=[{url:'https://blossom.primal.net',kind:'Blossom'},{url:'https://nostr.build',kind:'NIP-96'},{url:'https://cdn.satellite.earth',kind:'Blossom'}];S.mediaServer=0;
S.dmRelays=['wss://inbox.nostr.wine','wss://auth.nostr1.com'];
S.sets=[{id:'close',name:'Close friends',members:null},{id:'devs',name:'Nostr devs',members:['jun','kit','noor']}];
S.listSync=2;S.dmTab='chats';S.bubbleBar=null;
S.signerPerms={note:'always',react:'always',dm:'ask',zap:'ask',profile:'ask'};
S.push={enabled:false};
S.extDetected=false;
Object.assign(DEFAULT_SETTINGS,{wot:'fof',textScale:1,contrast:false,reduceMotion:false,dataSaver:false,requireAlt:false,muteListPrivate:true});
Object.keys(DEFAULT_SETTINGS).forEach(function(k){if(S.settings[k]===undefined)S.settings[k]=DEFAULT_SETTINGS[k]});
function saveDrafts(){store.set('drafts',S.drafts)}
function setMembers(s){return s.id==='close'?Array.from(S.close):s.members}
var PACKS=[{id:'builders',name:'Nostr builders',about:'People shipping clients, relays and specs',members:['jun','kit','noor']},{id:'photo',name:'Photographers',about:'Light, fog and tides',members:['ada','theo']},{id:'calm',name:'Calm reading',about:'Essays and slow notes',members:['mira','sol','rafa']}];

/* ---------- web of trust ---------- */
function wotOK(uid){
  if(uid==='me'||S.follows.has(uid))return true;
  var w=S.settings.wot;
  if(w==='off')return true;
  if(w==='strict')return false;
  return !(U[uid]&&U[uid].outside);
}

/* ---------- rich text ---------- */
var NOSTR_MAP={};
function buildNostrMap(){NOSTR_MAP={};Object.keys(U).forEach(function(k){NOSTR_MAP[U[k].npub]={t:'user',id:k}});Object.keys(N).forEach(function(k){NOSTR_MAP[NEV(k)]={t:'note',id:k}});Object.keys(ARTICLES).forEach(function(k){NOSTR_MAP[NADDR(k)]={t:'article',id:k}})}
function embedsOf(text){
  var out=[];(text.match(/nostr:(nevent1|naddr1|note1)[0-9a-z]+/g)||[]).forEach(function(m){var o=NOSTR_MAP[m.slice(6)];if(o)out.push(o)});return out;
}
function urlsOf(text){return text.match(/https?:\/\/[^\s<]+[^\s<.,:;!?)]/g)||[]}
fmtText=function(s){
  var tokens=[],put=function(h){tokens.push(h);return '\u0000'+(tokens.length-1)+'\u0000'};
  var h=String(s==null?'':s);
  h=h.replace(/https?:\/\/[^\s<]+[^\s<.,:;!?)]/g,function(u){var short=u.replace(/^https?:\/\//,'');if(short.length>32)short=short.slice(0,30)+'…';return put('<a class="link" href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(short)+'</a>')});
  h=h.replace(/nostr:((npub1|nevent1|naddr1|note1)[0-9a-z]+)/g,function(m,b){var o=NOSTR_MAP[b];
    if(o&&o.t==='user'){var u=U[o.id];return put('<button class="mention-chip" data-go="profile:'+o.id+'">'+avatar(o.id)+esc(u.name)+'</button>')}
    if(o)return put('');return put('<span class="key">'+esc(mid(b,10,4))+'</span>')});
  h=h.replace(/:([a-z]+):/g,function(m,k){return CUSTOM[k]?put(emo(m)):m});
  h=esc(h);
  h=h.replace(/(^|\s)@([a-z0-9]+)/g,function(m,p,u){var id=idFromHandle(u);return U[id]?p+'<button class="linkbtn" data-go="profile:'+id+'">@'+u+'</button>':m});
  h=h.replace(/(^|\s)#([a-z0-9]+)/gi,function(m,p,t){return p+'<button class="linkbtn" data-go="tag:'+t.toLowerCase()+'">#'+t+'</button>'});
  h=h.replace(/(wss:\/\/[^\s<,]+)/g,'<span class="key">$1</span>');
  h=h.replace(/\u0000(\d+)\u0000/g,function(m,i){return tokens[+i]});
  return h.replace(/\n/g,'<br>').replace(/\s+$/,'');
};
function previewHTML(u){
  var L=LINKS[u],site=u.replace(/^https?:\/\//,'').split('/')[0];
  if(!L)L={site:site,title:u.replace(/^https?:\/\//,'').split('/').slice(1).join(' / ')||site,desc:'',bg:'var(--surface-raised)'};
  return '<a class="preview" href="'+esc(u)+'" target="_blank" rel="noopener"><div class="preview__img" style="background:'+L.bg+'"></div><div class="preview__body"><span class="preview__site">'+esc(L.site)+'</span><span class="preview__title">'+esc(L.title)+'</span>'+(L.desc?'<span class="preview__desc">'+esc(L.desc)+'</span>':'')+'</div></a>';
}

/* ---------- media ---------- */
function mediaBG(m){if(!m)return '';if(m.indexOf&&m.indexOf('data:')===0)return '';var x=MEDIA[m];return x&&x.bg?x.bg:'var(--surface-raised)'}
function mbox(key,src,alt,act,extra){
  var isData=src&&src.indexOf('data:')===0,blur=!S.blurDone.has(key),saver=S.settings.dataSaver&&!S.loaded.has(key);
  var inner=isData?'<img src="'+src+'" alt="'+esc(alt||'')+'">':(MEDIA[src]&&MEDIA[src].specimen?'<div class="specimen" style="position:absolute;inset:0"><b>Hamburgefonstiv</b><span>Regular 13 · 16 · 34 px · open apertures</span></div>':'');
  return '<div class="mbox'+(blur&&!saver?' is-blur':'')+'" data-mk="'+key+'">'+
    '<button class="mbox__img" '+act+' aria-label="Open image'+(alt?': '+esc(alt):'')+'" style="'+(isData?'':'background:'+mediaBG(src))+'">'+(saver?'':inner)+'</button>'+
    (saver?'<button class="saver" data-act="load-media" data-v="'+key+'"><span>Tap to load image · 280 KB</span></button>':'')+
    (alt&&!saver?'<button class="alt-badge" data-act="alt" data-v="'+esc(alt)+'" aria-label="Image description">ALT</button>':'')+(extra||'')+'</div>';
}
mediaHTML=function(n){
  if(n.video){var v=n.video,key=n.id+':v',pl=S.playing.has(n.id),saver=S.settings.dataSaver&&!S.loaded.has(key);
    return '<div class="video'+(pl?' is-playing':'')+'" data-mk="'+key+'"><div class="video__frame" style="background:'+mediaBG(v.poster)+';background-size:140% 140%" role="img" aria-label="'+esc(v.alt)+'"></div>'+
      (saver?'<button class="saver" data-act="load-media" data-v="'+key+'"><span>Tap to load video · 6.4 MB</span></button>':'<button class="video__play" data-act="video" data-id="'+n.id+'" aria-label="'+(pl?'Pause':'Play')+' video">'+ic(pl?'pause':'play')+'</button>')+
      '<div class="video__bar"><span>'+(pl?'Playing':v.dur)+'</span><span class="video__track"><i></i></span><span>'+v.dur+'</span></div>'+
      '<button class="alt-badge" style="bottom:36px" data-act="alt" data-v="'+esc(v.alt)+'">ALT</button></div>';}
  var g=n.gallery;
  if(!g&&n.media)g=[{m:n.media,alt:(MEDIA[n.media]||{}).alt||''}];
  if(!g||!g.length)return '';
  if(g.length===1)return mbox(n.id+':0',g[0].m,g[0].alt,'data-act="gallery" data-id="'+n.id+'" data-v="0"');
  return '<div class="gallery" data-n="'+Math.min(4,g.length)+'">'+g.slice(0,4).map(function(x,i){return mbox(n.id+':'+i,x.m,x.alt,'data-act="gallery" data-id="'+n.id+'" data-v="'+i+'"')}).join('')+'</div>';
};
function galleryOf(n){var g=n.gallery;if(!g&&n.media)g=[{m:n.media,alt:(MEDIA[n.media]||{}).alt||''}];return g||[]}
function openGallery(id,i){
  var n=N[id],g=galleryOf(n);if(!g.length)return;i=Math.max(0,Math.min(g.length-1,i));
  var x=g[i],isData=x.m.indexOf('data:')===0,spec=MEDIA[x.m]&&MEDIA[x.m].specimen;
  var html='<div class="sheet-stack">'+head(U[n.author].name,true)+
    '<div class="lightbox" id="lightbox" data-id="'+id+'" data-i="'+i+'">'+(isData?'<img src="'+x.m+'" alt="'+esc(x.alt)+'">':spec?'<div class="specimen"><b>Hamburgefonstiv</b><span>Regular 13 · 16 · 34 px</span></div>':'<div role="img" aria-label="'+esc(x.alt)+'" style="background:'+mediaBG(x.m)+'"></div>')+'</div>'+
    '<p class="caption">'+(x.alt?esc(x.alt):'No description')+'</p>'+
    (g.length>1?'<div class="lb-nav"><button class="dk-iconbtn" data-act="lb-step" data-id="'+id+'" data-v="'+(i-1)+'" aria-label="Previous image"'+(i===0?' disabled':'')+'>'+ic('back')+'</button><span class="lb-dots">'+g.map(function(_,j){return '<i class="'+(j===i?'on':'')+'"></i>'}).join('')+'</span><button class="dk-iconbtn" data-act="lb-step" data-id="'+id+'" data-v="'+(i+1)+'" aria-label="Next image"'+(i===g.length-1?' disabled':'')+'>'+ic('chev')+'</button></div>':'')+'</div>';
  if(sheetState&&$('#lightbox'))setSheet(html);else openSheet(html,{label:'Image'});
  var lb=$('#lightbox');if(lb&&g.length>1){var x0=null;lb.addEventListener('pointerdown',function(e){x0=e.clientX});lb.addEventListener('pointerup',function(e){if(x0==null)return;var dx=e.clientX-x0;x0=null;if(Math.abs(dx)>50)openGallery(id,i+(dx<0?1:-1))})}
}

/* ---------- reactions ---------- */
function reactsRow(n,focus){
  var r=n.reacts||{},mine=S.myReacts[n.id]||{},keys=Object.keys(r);
  Object.keys(mine).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k)});
  if(!keys.length&&!focus)return '';
  var chips=keys.map(function(k){var c=(r[k]?r[k].c:0)+(mine[k]?1:0);return '<button class="react-chip" aria-pressed="'+!!mine[k]+'" data-act="react" data-id="'+n.id+'" data-v="'+esc(k)+'" aria-label="React '+esc(k)+(c?', '+c:'')+'">'+emo(k)+(S.settings.hideCounts?'':'<span>'+fmt(c)+'</span>')+'</button>'}).join('');
  return '<div class="reacts">'+chips+'<button class="react-chip react-add" data-act="react-pick" data-id="'+n.id+'" aria-label="Add a reaction">'+ic('smile')+(keys.length?'':'<span>React</span>')+'</button></div>'+
    (focus&&(keys.length||n.likes)?'<button class="linkbtn reacted-link" data-act="reactors" data-id="'+n.id+'">See who reacted</button>':'');
}
function toggleReact(id,e){
  var m=S.myReacts[id]=S.myReacts[id]||{};
  if(m[e])delete m[e];else{m[e]=1;rememberEmoji(e)}
  render();
}
var RECENT=store.get('recentEmoji',['🔥','🙏',':dusk:','👀']);
function rememberEmoji(e){RECENT=[e].concat(RECENT.filter(function(x){return x!==e})).slice(0,8);store.set('recentEmoji',RECENT)}
function emojiGrid(list,id){return '<div class="emoji-grid">'+list.map(function(e){return '<button class="emoji-btn" data-act="react-choose" data-id="'+id+'" data-v="'+esc(e)+'" aria-label="'+esc(e)+'">'+emo(e)+'</button>'}).join('')+'</div>'}
function openReactPicker(id,q){
  q=(q||'').toLowerCase().trim();
  var all=EMOJI.filter(function(x){return !q||x[1].indexOf(q)>=0||x[0]===q}).map(function(x){return x[0]});
  var cus=Object.keys(CUSTOM).filter(function(k){return !q||k.indexOf(q)>=0}).map(function(k){return ':'+k+':'});
  var body=(q?'':'<div class="emoji-section">Recent</div>'+emojiGrid(RECENT,id))+
    '<div class="emoji-section">Dusk pack</div>'+(cus.length?emojiGrid(cus,id):'<p class="caption">No custom emoji match</p>')+
    '<div class="emoji-section">Emoji</div>'+(all.length?emojiGrid(all,id):'<p class="caption">Nothing matches “'+esc(q)+'”</p>');
  var html='<div class="sheet-stack">'+head('React',true)+'<label class="searchbox">'+ic('search')+'<span class="sr-only">Search emoji</span><input id="emoji-q" data-id="'+id+'" type="search" placeholder="Search emoji" value="'+esc(q)+'" autocomplete="off"></label><div id="emoji-body">'+body+'</div></div>';
  if(q!==undefined&&$('#emoji-body')){$('#emoji-body').innerHTML=body;return}
  openSheet(html,{label:'Pick a reaction'});
}
function openReactors(id){
  var n=N[id],r=n.reacts||{},mine=S.myReacts[id]||{};
  var rows=[];
  var likeWho=['ada','sol','noor'].filter(function(x){return x!==n.author});if(S.liked.has(id))likeWho.unshift('me');
  rows.push(['❤️',likeWho,n.likes+(S.liked.has(id)?1:0)]);
  Object.keys(r).forEach(function(k){var w=r[k].who.slice();if(mine[k])w.unshift('me');rows.push([k,w,r[k].c+(mine[k]?1:0)])});
  Object.keys(mine).forEach(function(k){if(!r[k])rows.push([k,['me'],1])});
  openSheet('<div class="sheet-stack">'+head('Reactions',true)+'<div class="reactors">'+rows.filter(function(x){return x[2]>0}).map(function(x){var more=x[2]-x[1].length;
    return '<div class="reactors__row"><span class="reactors__emoji">'+emo(x[0])+'</span><span class="reactors__who">'+x[1].map(function(u){return avatarBtn(u)}).join('')+'<span class="caption">'+x[1].map(function(u){return u==='me'?'You':first(u)}).join(', ')+(more>0?' and '+fmt(more)+' others':'')+'</span></span></div>'}).join('')+'</div></div>',{label:'Reactions'});
}

/* ---------- polls, live, events, badges ---------- */
function pollHTML(n){
  var p=n.poll,v=S.votes[n.id],total=p.votes.reduce(function(a,b){return a+b},0)+(v!=null?1:0);
  return '<div class="poll'+(v!=null?' is-voted':'')+'" role="group" aria-label="Poll">'+p.options.map(function(o,i){var c=p.votes[i]+(v===i?1:0),pct=total?Math.round(c*100/total):0;
    return '<button class="poll__opt'+(v===i?' is-mine':'')+'" data-act="vote" data-id="'+n.id+'" data-v="'+i+'"'+(v!=null?' aria-disabled="true"':'')+'>'+(v!=null?'<i style="width:'+pct+'%"></i>':'')+'<span>'+esc(o)+(v===i?' · your vote':'')+'</span>'+(v!=null?'<b>'+pct+'%</b>':'')+'</button>'}).join('')+
    '<span class="poll__meta">'+fmt(total)+' votes · ends in '+Math.round(p.ends/1440)+' days'+(v==null?' · tap to vote':'')+'</span></div>';
}
function liveHTML(n){var l=n.live;return '<button class="livecard" data-go="live:'+n.id+'"><span class="livecard__thumb"><span class="badge-live">Live</span></span><span style="display:grid;gap:2px;min-width:0"><b>'+esc(l.title)+'</b><span>'+esc(U[n.author].name)+' · '+fmt(l.viewers+(S.watching===n.id?1:0))+' watching</span></span></button>'}
function eventHTML(n){var ev=n.event,r=S.rsvp[n.id];
  var going=ev.going+(r==='going'?1:0),maybe=ev.maybe+(r==='maybe'?1:0);
  return '<div class="eventcard"><div class="eventcard__head"><span class="cal"><i>'+ev.mon.toUpperCase()+'</i><b>'+ev.day+'</b></span><span style="display:grid;gap:2px;min-width:0"><b>'+esc(ev.title)+'</b><span class="eventcard__line">'+esc(ev.when)+'</span><span class="eventcard__line">'+esc(ev.where)+'</span><span class="eventcard__line">'+going+' going · '+maybe+' maybe</span></span></div>'+
    '<div class="rsvp" role="group" aria-label="RSVP">'+[['going','Going'],['maybe','Maybe'],['no',"Can't go"]].map(function(o){return '<button class="dk-chip mini-chip" aria-pressed="'+(r===o[0])+'" data-act="rsvp" data-id="'+n.id+'" data-v="'+o[0]+'">'+o[1]+'</button>'}).join('')+'</div></div>';
}
function badgeSVG(b){var B=BADGES[b];return '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 2l14 8v16l-14 8-14-8V10z" fill="var(--'+B.tone+')" stroke="var(--surface)" stroke-width="1.5"/><text x="18" y="23" text-anchor="middle" font-family="Figtree,sans-serif" font-weight="600" font-size="13" fill="var(--on-accent)">'+B.glyph+'</text></svg>'}
function badgesHTML(id){var list=(USER_BADGES[id]||[]).filter(function(x){return x.ok||id==='me'});if(!list.length)return '';
  return '<div class="badges">'+list.map(function(x){return '<button class="badge'+(x.ok?'':' is-pending')+'" data-act="badge" data-id="'+id+'" data-v="'+x.b+'" aria-label="Badge: '+esc(BADGES[x.b].name)+(x.ok?'':' (not accepted yet)')+'">'+badgeSVG(x.b)+'</button>'}).join('')+'</div>'}

/* ---------- note ---------- */
noteHTML=function(n,o){
  o=o||{};var u=U[n.author],s=S.settings;
  var liked=S.liked.has(n.id),rp=S.reposted.has(n.id),zp=S.zapped[n.id]||0;
  var nrep=repliesOf(n.id).length;
  var hidden=n.cw&&!S.revealed.has(n.id);
  var by=o.by?'<div class="note-by">'+ic('repost')+'<span>'+(o.by==='me'?'You':esc(U[o.by].name))+' reposted</span></div>':'';
  var par=(n.parent&&!o.inThread&&N[n.parent])?'<div class="note-by">'+ic('reply')+'<span>Replying to @'+handle(N[n.parent].author)+'</span></div>':'';
  var embeds=embedsOf(n.text).map(function(e){return e.t==='note'?quoteCard(e.id):articleCard({article:e.id})}).join('');
  var urls=urlsOf(n.text);
  var body=hidden
    ?'<div class="cw">'+ic('eyeoff')+'<span class="cw__text">'+esc(n.cw)+'</span><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="cw" data-id="'+n.id+'">Show</button></div>'
    :'<p class="dk-note__body">'+fmtText(n.text)+'</p>'+(n.cw?'<button class="linkbtn cw-hide" data-act="cw" data-id="'+n.id+'">Hide again</button>':'')+
      mediaHTML(n)+(n.poll?pollHTML(n):'')+(n.live?liveHTML(n):'')+(n.event?eventHTML(n):'')+embeds+(urls.length&&!n.media&&!n.gallery?previewHTML(urls[0]):'')+(n.article?articleCard(n):'')+(n.quote?quoteCard(n.quote):'');
  var pend=n.pending?'<span class="pend">'+ic('wifi')+'Waiting to send</span>':'';
  var likes=n.likes+(liked?1:0),reps=n.reposts+(rp?1:0),zs=n.zaps+zp;
  var meta=o.focus?'<div class="focus-meta">'+agoLong(n.t)+(s.hideCounts?'':[likes?' · '+fmt(likes)+plural(likes,' like',' likes'):'',reps?' · '+fmt(reps)+plural(reps,' repost',' reposts'):'',zs?' · '+fmt(zs)+' sats':''].join(''))+'</div>':'';
  var actions='<div class="dk-note__actions">'+
    '<button class="dk-iconbtn" data-act="reply" data-id="'+n.id+'" aria-label="Reply'+(nrep?', '+nrep+' replies':'')+'">'+ic('reply')+'<span>'+cnt(nrep)+'</span></button>'+
    '<button class="dk-iconbtn is-repost" aria-pressed="'+rp+'" data-act="repost" data-id="'+n.id+'" aria-label="Repost">'+ic('repost')+'<span>'+cnt(reps)+'</span></button>'+
    '<button class="dk-iconbtn is-like'+(popLike===n.id?' pop':'')+'" aria-pressed="'+liked+'" data-act="like" data-id="'+n.id+'" aria-label="Like. Long-press for more reactions">'+ic('like')+'<span class="cnt">'+cnt(likes)+'</span>'+(popLike===n.id?HEARTS:'')+'</button>'+
    '<button class="dk-iconbtn is-zap" aria-pressed="'+(zp>0)+'" data-act="zap" data-id="'+n.id+'" aria-label="Zap">'+ic('zap')+'<span>'+cnt(zs)+'</span></button>'+
    '<button class="dk-iconbtn" data-act="more" data-id="'+n.id+'" aria-label="More options">'+ic('more')+'</button></div>';
  var start=s.swipeStart,end=s.swipeEnd;
  return '<div class="dk-swipe'+(o.isNew?' is-new':'')+'" data-note="'+n.id+'"'+(o.preview?' data-preview':'')+'>'+swipeSides(start,end,n)+
    '<div class="dk-swipe__content"><article class="dk-note'+(o.focus?' is-focus':'')+'" tabindex="0" aria-label="'+esc(u.name)+': '+esc(n.text.replace(/nostr:\S+/g,'').slice(0,90))+'">'+
    avatarBtn(n.author)+'<div class="note-main">'+by+par+
    '<div class="dk-note__head"><span class="dk-note__name">'+esc(u.name)+'</span><span class="dk-note__meta">@'+handle(n.author)+' · '+ago(n.t)+'</span></div>'+
    body+(hidden?'':reactsRow(n,o.focus))+pend+meta+actions+'</div></article></div></div>';
};

/* ---------- thread with web-of-trust filtering + muted threads ---------- */
function rootOf(id){var n=N[id];while(n&&n.parent&&N[n.parent])n=N[n.parent];return n?n.id:id}
V.thread=function(scr){
  var n=N[scr.id];
  if(!n||n.deleted)return {key:'thread:'+scr.id,title:'Note',body:emptyHTML('Note deleted','This note is no longer available.')};
  var parent=n.parent&&N[n.parent]&&!N[n.parent].deleted?N[n.parent]:null;
  var all=repliesOf(n.id).reverse(),shown=all.filter(function(r){return wotOK(r.author)}),hidden=all.length-shown.length,showAll=S.showHidden.has(n.id);
  var list=showAll?all:shown,root=rootOf(n.id),muted=S.mutedThreads.has(root);
  return {key:'thread:'+n.id,title:'Note',
    actions:'<button class="dk-iconbtn" data-act="more" data-id="'+n.id+'" aria-label="More options">'+ic('more')+'</button>',
    body:(muted?'<div class="banner-note">'+ic('mute')+'<span class="banner-note__text">Thread muted. You won\'t get notifications from it.</span><button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="mute-thread" data-id="'+n.id+'">Unmute</button></div>':'')+
      '<div class="list">'+(parent?noteHTML(parent,{inThread:true}):'')+noteHTML(n,{focus:true,inThread:true})+'</div>'+
      (list.length?'<div class="thread-label">'+list.length+plural(list.length,' reply',' replies')+'</div><div class="list">'+list.map(function(r){return noteHTML(r,{inThread:true})}).join('')+'</div>':(hidden?'':'<p class="endcap">No replies yet</p>'))+
      (hidden?'<div class="hidden-replies"><span>'+(showAll?'Showing ':'')+hidden+plural(hidden,' reply',' replies')+' from people outside your network'+(showAll?'':' hidden')+'</span><button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="show-hidden" data-id="'+n.id+'">'+(showAll?'Hide':'Show')+'</button></div>':''),
    footer:'<div class="replybar"><button data-act="reply" data-id="'+n.id+'">'+avatar('me','dk-avatar--sm')+'Reply to '+esc(first(n.author))+'…</button></div>'};
};
var _activityView=V.activity;
V.activity=function(){
  var keep=NOTIFS,hid=0;
  NOTIFS=NOTIFS.filter(function(x){var ok=wotOK(x.who[0])&&!(x.note&&N[x.note]&&S.mutedThreads.has(rootOf(x.note)));if(!ok)hid++;return ok});
  var v=_activityView();NOTIFS=keep;
  if(hid)v.body+='<p class="endcap">'+hid+plural(hid,' notification',' notifications')+' from outside your network hidden. <button class="linkbtn" data-go="settings:safety">Change filter</button></p>';
  return v;
};
unreadActivity=function(){return NOTIFS.some(function(x){return x.unread&&!S.muted.has(x.who[0])&&wotOK(x.who[0])})};

/* ---------- live stream screen ---------- */
V.live=function(scr){
  var n=N[scr.id],l=n.live;S.watching=n.id;
  return {key:'live:'+n.id,title:l.title,
    actions:'<button class="dk-iconbtn" data-act="zap" data-id="'+n.id+'" aria-label="Zap the stream">'+ic('zap')+'</button>',
    body:'<div class="stream" role="img" aria-label="Live video: '+esc(l.title)+'"><div class="stream__top"><span class="badge-live">Live</span><span>'+fmt(l.viewers+1)+' watching</span></div></div>'+
      '<div class="stream__title"><h2>'+esc(l.title)+'</h2><div class="byline">'+avatarBtn(n.author)+'<span><b>'+esc(U[n.author].name)+'</b>Started '+ago(n.t)+' ago</span>'+followBtn(n.author,true)+'</div></div>'+
      '<div class="thread-label">Live chat</div><div class="livechat" id="livechat">'+LIVECHAT.map(liveMsg).join('')+'</div>',
    footer:'<form class="composer" data-form="livechat"><label class="sr-only" for="live-input">Chat</label><textarea id="live-input" rows="1" placeholder="Say something"></textarea><button class="send" type="submit" aria-label="Send">'+ic('send')+'</button></form>',chat:true};
};
function liveMsg(m){return '<div class="livechat__msg'+(m.z?' livechat__zap':'')+'">'+avatar(m.f)+'<span><b>'+esc(m.f==='me'?'You':first(m.f))+'</b>'+(m.z?'zapped '+fmt(m.z)+' sats · ':'')+fmtText(m.x)+'</span></div>'}
setInterval(function(){
  var lc=$('#livechat');if(!lc||!LIVECHAT_POOL.length||document.hidden)return;
  var m=LIVECHAT_POOL.shift();LIVECHAT.push(m);lc.insertAdjacentHTML('beforeend',liveMsg(m));
  var sc=lc.closest('.scroller');if(sc&&sc.scrollHeight-sc.scrollTop-sc.clientHeight<160)sc.scrollTop=sc.scrollHeight;
},3500);

/* ---------- connections (following / followers) ---------- */
V.connections=function(scr){
  var p=scr.id.split(':'),id=p[0],tab=p[1]||'following';
  var people=Object.keys(U).filter(function(k){return k!==id&&k!=='me'&&!U[k].isIdent&&!U[k].outside});
  var list=tab==='following'?(id==='me'?Array.from(S.follows):people.filter(function(k,i){return i%2===0})):(id==='me'?people.filter(function(k){return U[k].followsYou}).concat(['lena']):people.filter(function(k,i){return i%3!==1}));
  var tabs=[['following','Following'],['followers','Followers']];
  return {key:'connections:'+scr.id,title:U[id].name,
    sub:'<div class="dk-chips" role="tablist" aria-label="Connections">'+tabs.map(function(t){return '<button class="dk-chip" role="tab" aria-selected="'+(tab===t[0])+'" data-act="conn-tab" data-id="'+id+'" data-v="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div>',
    body:list.length?'<div class="group">'+list.map(function(k){return personRow(k)}).join('')+'</div><p class="endcap">Showing people Dusk could load from your servers</p>':emptyHTML('Nobody yet','People will show up here.')};
};

/* ---------- profile ---------- */
V.profile=function(scr){
  var id=scr.id,u=U[id],me=id==='me';
  var tab=S.profileTab[id]||'notes';
  var tabs=[['notes','Notes'],['replies','Replies'],['media','Media']];if(me)tabs.push(['bookmarks','Bookmarks']);
  var notes,arr;
  if(tab==='notes'){
    arr=topNotes().filter(function(n){return n.author===id}).map(function(n){return {n:n,t:n.t}});
    REPOSTS.forEach(function(r){if(r.by===id&&N[r.note]&&!N[r.note].deleted)arr.push({n:N[r.note],t:r.t,by:r.by})});
    notes=arr.sort(function(a,b){return a.t-b.t}).map(function(i){return noteHTML(i.n,{by:i.by})}).join('');
  }else if(tab==='replies'){
    notes=Object.keys(N).map(function(k){return N[k]}).filter(function(n){return n.parent&&n.author===id&&!n.deleted}).sort(function(a,b){return a.t-b.t}).map(function(n){return noteHTML(n)}).join('');
  }else if(tab==='media'){
    notes=topNotes().filter(function(n){return n.author===id&&(n.media||n.gallery||n.video)}).sort(function(a,b){return a.t-b.t}).map(function(n){return noteHTML(n)}).join('');
  }else{
    notes=Array.from(S.bookmarks).map(function(k){return N[k]}).filter(function(n){return n&&!n.deleted}).map(function(n){return noteHTML(n)}).join('');
  }
  var muted=S.muted.has(id);
  var btns=me?'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="edit-profile">'+ic('edit')+'Edit profile</button><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="qr" data-id="me" aria-label="Show QR code">'+ic('qr')+'</button>'
    :(muted?'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="unmute" data-id="'+id+'">Unmute</button>':'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="dm" data-id="'+id+'" aria-label="Message '+esc(u.name)+'">'+ic('message')+'</button>'+followBtn(id,true));
  var nip=u.nip05?(u.nip05Failed?'<span class="nip05-fail">'+ic('warn')+esc(u.nip05)+' · couldn\'t verify</span>':verifiedHTML(u)):'<span class="caption">@'+esc(handle(id))+' · no verified address</span>';
  var banner=u.bannerSrc?'<div class="pbanner" style="background-image:url('+u.bannerSrc+')"></div>':u.banner?'<div class="pbanner" style="background:'+mediaBG(u.banner)+';background-size:cover"></div>':'<div class="banner" style="--tone:var(--'+u.tone+')"></div>';
  var links=[];
  if(u.website)links.push('<a href="https://'+esc(u.website)+'" target="_blank" rel="noopener">'+ic('globe')+esc(u.website)+'</a>');
  if(u.lud16)links.push('<button data-act="'+(me?'copy':'zap-profile')+'" data-id="'+id+'" data-copy="'+esc(u.lud16)+'" data-msg="Copied lightning address">'+ic('bolt')+esc(u.lud16)+'</button>');
  return {key:'profile:'+id+':'+tab,title:me&&!scr.pushed?'You':u.name,fab:me,
    actions:me?'<button class="dk-iconbtn" data-go="settings:root" aria-label="Settings">'+ic('settings')+'</button>':'<button class="dk-iconbtn" data-act="profile-more" data-id="'+id+'" aria-label="More options">'+ic('more')+'</button>',
    body:banner+'<div class="phead"><div class="phead__top"><button class="dk-avatar dk-avatar--lg" data-tone="'+u.tone+'" data-act="'+(me?'me-menu':'avatar-view')+'" data-id="'+id+'" aria-label="'+(me?'Your photo: view or edit':'View '+esc(u.name)+'\'s photo')+'">'+avInner(u)+(me?'<span class="av-edit" aria-hidden="true">'+ic('edit')+'</span>':'')+'</button><div class="phead__btns">'+btns+'</div></div>'+
      '<div><h2 class="phead__name">'+esc(u.name)+'</h2>'+nip+'</div>'+
      (u.about?'<p class="phead__about">'+fmtText(u.about)+'</p>':'')+
      (links.length?'<div class="plinks">'+links.join('')+'</div>':'')+
      '<div class="phead__meta"><button data-go="connections:'+id+':following"><b>'+(me?S.follows.size:u.following)+'</b> following</button><button data-go="connections:'+id+':followers"><b>'+u.followers+'</b> followers</button>'+(u.followsYou?'<span class="followsyou">Follows you</span>':'')+'</div>'+
      badgesHTML(id)+
      '<div class="keyrow"><span class="key">'+mid(u.npub,12,6)+'</span><button class="dk-iconbtn" data-act="copy" data-copy="'+u.npub+'" data-msg="Copied public key" aria-label="Copy public key">'+ic('copy')+'</button><button class="dk-iconbtn" data-act="qr" data-id="'+id+'" aria-label="Show QR code">'+ic('qr')+'</button></div></div>'+
      '<div class="dk-chips ptabs" role="tablist" aria-label="Profile sections">'+tabs.map(function(t){return '<button class="dk-chip" role="tab" aria-selected="'+(tab===t[0])+'" data-act="ptab" data-id="'+id+'" data-v="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div>'+
      (notes?'<div class="list">'+notes+'</div>':emptyHTML(tab==='bookmarks'?'No bookmarks':'Nothing here yet',tab==='bookmarks'?'Long-press a note or swipe to bookmark it. Bookmarks sync to your servers as a private list.':'Notes will show up here.'))};
};
function openQR(id){
  var u=U[id],uri='nostr:'+u.npub;
  openSheet('<div class="sheet-stack" style="text-align:center">'+head(u.name,true)+'<div class="qr" id="qr" aria-label="QR code for '+esc(u.name)+'"></div><span class="key">'+mid(u.npub,14,8)+'</span><div class="btnrow"><button class="dk-btn dk-btn--secondary" data-act="copy" data-copy="'+uri+'" data-msg="Copied nostr: link">'+ic('copy')+'Copy link</button><button class="dk-btn dk-btn--secondary" data-act="copy" data-copy="'+esc(u.nip05||u.npub)+'" data-msg="Copied address">'+ic('at')+'Copy address</button></div><p class="caption">Anyone can scan this in a Nostr app to open the profile.</p></div>',{label:'QR code'});
  var box=$('#qr');
  try{new QRCode(box,{text:uri,width:200,height:200,colorDark:'#14151a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
  catch(e){box.innerHTML='<p class="caption" style="width:200px;color:#14151a">QR code unavailable here. Copy the link instead.</p>'}
}
function openBadge(uid,b){
  var B=BADGES[b],own=uid==='me',rec=(USER_BADGES[uid]||[]).filter(function(x){return x.b===b})[0];
  openSheet('<div class="sheet-stack" style="justify-items:center;text-align:center"><span style="width:96px;height:96px;display:block">'+badgeSVG(b).replace('<svg','<svg style="width:96px;height:96px"')+'</span><div><h2 class="dk-sheet__title" style="margin:0">'+esc(B.name)+'</h2><p class="sheet-text">'+esc(B.desc)+'</p><p class="caption">Awarded by '+esc(U[B.issuer]?U[B.issuer].name:'Dusk')+'</p></div>'+
    (own?(rec.ok?'<button class="dk-btn dk-btn--secondary" data-act="badge-toggle" data-v="'+b+'">Hide from profile</button>':'<button class="dk-btn dk-btn--primary" data-act="badge-toggle" data-v="'+b+'">Show on my profile</button>'):'')+'</div>',{label:'Badge'});
}

/* ---------- messages ---------- */
convList=function(){return Object.keys(CONVS).filter(function(k){return !CONVS[k].muted&&!CONVS[k].request&&!S.muted.has(CONVS[k].with)}).sort(function(a,b){var A=CONVS[a].msgs,B=CONVS[b].msgs;return (A.length?A[A.length-1].t:0)-(B.length?B[B.length-1].t:0)})};
function requestList(){return Object.keys(CONVS).filter(function(k){return CONVS[k].request&&!CONVS[k].muted&&!S.muted.has(CONVS[k].with)})}
function lastText(m){return m.img?'Photo':m.x}
V.messages=function(){
  var reqs=requestList(),tab=S.dmTab,keys=tab==='requests'?reqs.filter(function(k){return wotOK(CONVS[k].with)||S.settings.wot==='off'}):convList();
  var filtered=tab==='requests'?reqs.length-keys.length:0;
  var rows=keys.map(function(k){
    var c=CONVS[k],u=U[c.with],last=c.msgs[c.msgs.length-1]||{x:'No messages yet',t:0,f:''};
    return '<div class="dk-swipe" data-conv="'+k+'">'+
      '<div class="dk-swipe__side dk-swipe__side--start" data-action="read">'+ic('check')+'<span>'+(c.unread?'Mark read':'Mark unread')+'</span></div>'+
      '<div class="dk-swipe__side dk-swipe__side--end" data-action="mute"><span>'+(c.request?'Delete':'Mute')+'</span>'+ic('mute')+'</div>'+
      '<div class="dk-swipe__content"><button class="conv'+(c.unread?' is-unread':'')+'" data-go="chat:'+k+'">'+avatar(c.with)+'<span style="min-width:0"><span class="conv__name">'+esc(u.name)+'</span><span class="conv__last" style="display:block">'+(last.f==='me'?'You: ':'')+esc(lastText(last))+'</span></span><span class="notif__side"><span>'+ago(last.t)+'</span>'+(c.unread?'<span class="dot" aria-label="Unread"></span>':'')+'</span></button></div></div>';
  }).join('');
  var chips=[['chats','Chats'],['requests','Requests'+(reqs.length?' · '+reqs.length:'')]].map(function(c){return '<button class="dk-chip" role="tab" aria-selected="'+(tab===c[0])+'" data-act="dm-tab" data-v="'+c[0]+'">'+c[1]+'</button>'}).join('');
  return {key:'messages:'+tab,title:'Messages',actions:'<button class="dk-iconbtn" data-act="new-dm" aria-label="New message">'+ic('edit')+'</button>',
    sub:'<div class="dk-chips" role="tablist" aria-label="Message folders">'+chips+'</div>',
    body:(tab==='requests'?'<div class="banner-note">'+ic('shield')+'<span class="banner-note__text">Messages from people you don\'t follow. They can\'t see if you\'ve read them.</span></div>':'')+
      (rows?'<div class="list" style="margin-top:8px">'+rows+'</div>':emptyHTML(tab==='requests'?'No requests':'No messages yet',tab==='requests'?'New people who message you show up here first.':'Start a private conversation with anyone you follow.'))+
      (filtered?'<p class="endcap">'+filtered+plural(filtered,' request',' requests')+' filtered as likely spam. <button class="linkbtn" data-act="dm-show-filtered">Show</button></p>':'')+
      '<p class="endcap">'+ic('lock')+' End-to-end encrypted with NIP-17. Delivered through your private message servers.</p>'};
};
V.chat=function(scr){
  var c=CONVS[scr.id],u=U[c.with];
  var html='<div class="chat"><div class="chat__note">'+ic('lock')+'End-to-end encrypted (NIP-17). Only you and '+esc(first(c.with))+' can read these.</div>';
  c.msgs.forEach(function(m,i){var mine=m.f==='me',key=scr.id+':'+i;
    html+='<div class="bubble-wrap'+(mine?' mine':'')+'">'+(S.bubbleBar===key?'<div class="quickbar" role="group" aria-label="React">'+['❤️','😂','👍','😮','🔥','🙏'].map(function(e){return '<button data-act="bubble-react" data-id="'+key+'" data-v="'+e+'" aria-label="'+e+'">'+e+'</button>'}).join('')+'</div>':'')+
      '<button class="bubble'+(mine?' mine':'')+(m.img?' has-img':'')+'" data-act="bubble" data-id="'+key+'" aria-label="Message. Tap to react">'+(m.img?'<img src="'+m.img+'" alt="Photo">':fmtText(m.x))+'</button>'+
      (m.react?'<span class="bubble-react">'+m.react+'</span>':'')+'</div>';
    var nx=c.msgs[i+1];if(!nx||nx.f!==m.f||m.t-nx.t>30)html+='<div class="bubble-time'+(mine?' mine':'')+'">'+(m.pending?'Waiting to send':ago(m.t))+'</div>'});
  html+='</div>';
  var req=c.request?'<div class="request-bar"><span>'+esc(u.name)+' isn\'t someone you follow. Accept to reply and move this to Chats.</span><div class="btnrow"><button class="dk-btn dk-btn--primary dk-btn--sm" data-act="dm-accept" data-id="'+scr.id+'">Accept</button><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="dm-delete" data-id="'+scr.id+'">Delete</button><button class="dk-btn dk-btn--danger dk-btn--sm" data-act="dm-block" data-id="'+scr.id+'">Block</button></div></div>':'';
  return {key:'chat:'+scr.id,title:u.name,chat:true,
    actions:'<button class="dk-iconbtn" data-go="profile:'+c.with+'" aria-label="View profile">'+ic('user')+'</button>',
    body:req+html,
    footer:c.request?'':'<form class="composer" data-form="chat" data-id="'+scr.id+'"><button type="button" class="dk-iconbtn" data-act="chat-attach" data-id="'+scr.id+'" aria-label="Send a photo">'+ic('image')+'</button><label class="sr-only" for="chat-input">Message</label><textarea id="chat-input" rows="1" placeholder="Message '+esc(first(c.with))+'"></textarea><button class="send" type="submit" aria-label="Send">'+ic('send')+'</button></form>'};
};
unreadDMs=function(){return convList().some(function(k){return CONVS[k].unread})||requestList().some(function(k){return CONVS[k].unread&&wotOK(CONVS[k].with)})};

/* ---------- search: follow packs ---------- */
var _searchResults=searchResults;
searchResults=function(q){
  var base=_searchResults(q);
  if((q||'').trim())return base;
  return '<div class="group-label">Follow packs</div><div class="packs">'+PACKS.map(function(p){return '<button class="pack" data-act="pack" data-id="'+p.id+'"><span style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>'+esc(p.name)+'</b><span class="avstack">'+p.members.map(function(m){return avatar(m)}).join('')+'</span></span><span>'+esc(p.about)+' · '+p.members.length+' people</span></button>'}).join('')+'</div>'+base;
};
function openPack(pid){
  var p=PACKS.filter(function(x){return x.id===pid})[0],all=p.members.every(function(m){return S.follows.has(m)});
  openSheet('<div class="sheet-stack">'+head(p.name,true)+'<p class="sheet-text">'+esc(p.about)+'</p><div class="group" style="border-radius:14px;overflow:hidden">'+p.members.map(function(m){return personRow(m)}).join('')+'</div>'+
    (all?'<p class="caption" style="text-align:center">You follow everyone in this pack.</p>':'<button class="dk-btn dk-btn--primary dk-btn--lg" data-act="pack-follow" data-id="'+pid+'">Follow all '+p.members.length+'</button>')+'</div>',{label:p.name});
}

/* ---------- composer: multiple media, alt text, servers, mentions, polls, drafts ---------- */
openCompose=function(o){
  o=o||{};
  compose={replyTo:o.replyTo,quote:o.quote,files:[],cw:false,poll:null,draftId:o.draftId||null,posted:false,ac:null,acIndex:0};
  var text=o.text||'';
  var ctxLine='';
  if(o.replyTo){var p=N[o.replyTo];ctxLine='<div class="compose-ctx">'+ic('reply')+'<span>Replying to <b>'+esc(U[p.author].name)+'</b>: '+esc(p.text.replace(/nostr:\S+/g,'').slice(0,70))+(p.text.length>70?'…':'')+'</span></div>'}
  if(o.shared)ctxLine='<div class="compose-ctx">'+ic('share2')+'<span>Shared from '+esc(o.shared)+'</span></div>';
  var off=S.settings.offline,srv=S.mediaServers[S.mediaServer];
  openSheet(
    '<div class="sheet-head"><button class="dk-btn dk-btn--ghost dk-btn--sm" data-close>Cancel</button><h2 class="dk-sheet__title">'+(o.replyTo?'Reply':o.quote?'Quote':'New note')+'</h2><button class="dk-btn dk-btn--primary dk-btn--sm" data-act="post" id="post-btn"'+(text?'':' disabled')+'>'+(o.replyTo?'Reply':'Post')+'</button></div>'+
    ctxLine+
    '<div class="compose-row">'+avatar('me')+'<div class="dk-field"><label class="sr-only" for="compose-text">Note</label><textarea id="compose-text" rows="5" autofocus placeholder="'+(o.replyTo?'Write your reply':'What\'s on your mind? Type @ to mention, # for tags')+'">'+esc(text)+'</textarea></div></div>'+
    '<div id="ac" role="listbox" aria-label="Suggestions"></div>'+
    '<div class="dk-field" id="cw-field" hidden style="margin-top:12px"><label class="dk-field__label" for="cw-text">Content warning</label><input id="cw-text" placeholder="Say what it\'s about, like “spoilers”"><span class="dk-field__help">People see this first and tap to show your note.</span></div>'+
    '<div id="thumbs"></div><div id="poll-edit"></div>'+(o.quote?quoteCard(o.quote):'')+
    '<div class="compose-tools"><button class="dk-iconbtn" data-act="attach" aria-label="Add photos">'+ic('image')+'</button><button class="dk-iconbtn" data-act="poll-add" aria-label="Add a poll">'+ic('poll')+'</button><button class="dk-iconbtn" aria-pressed="false" data-act="cw-toggle" aria-label="Content warning">'+ic('eyeoff')+'</button><button class="dk-iconbtn" data-act="mention" aria-label="Mention someone">'+ic('at')+'</button><button class="dk-iconbtn" data-act="drafts" aria-label="Drafts">'+ic('list')+(S.drafts.length?'<span>'+S.drafts.length+'</span>':'')+'</button>'+
    '<span class="caption"><span>'+(off?'Offline. Dusk sends it later.':'Posting as '+esc(U.me.name))+'</span><button class="server-chip" data-act="media-server" aria-label="Change media server">'+ic('server')+esc(srv.url.replace('https://',''))+'</button></span></div>',
    {label:o.replyTo?'Reply':'New note',onClose:function(){
      var c=compose;compose=null;if(!c||c.posted)return;
      var t=($('#compose-text')||{}).value||c.lastText||'';
      if(t.trim()&&!c.replyTo){saveDraft(t,c.draftId);toast('Saved to drafts')}
    }});
  if(text)updatePostBtn();
};
function saveDraft(text,id){
  if(id){S.drafts.forEach(function(d){if(d.id===id){d.text=text;d.t=Date.now()}})}
  else S.drafts.unshift({id:'d'+Date.now(),text:text,t:Date.now()});
  saveDrafts();
}
updatePostBtn=function(){
  var t=$('#compose-text'),b=$('#post-btn');if(!t||!b||!compose)return;
  compose.lastText=t.value;
  var uploading=compose.files.some(function(f){return f.p<100});
  var pollOk=!compose.poll||compose.poll.options.filter(function(x){return x.trim()}).length>=2;
  b.disabled=!(t.value.trim()||compose.files.length)||uploading||!pollOk;
  b.textContent=uploading?'Uploading…':(compose.replyTo?'Reply':'Post');
};
function renderThumbs(){
  var box=$('#thumbs');if(!box||!compose)return;
  box.innerHTML=compose.files.length?'<div class="thumbs">'+compose.files.map(function(f,i){
    return '<div class="thumb"><div class="thumb__img"><img src="'+f.src+'" alt="'+esc(f.alt||'Photo '+(i+1))+'">'+(f.p<100?'<span class="thumb__prog"><i style="width:'+f.p+'%"></i></span>':'')+'<button class="thumb__x" data-act="thumb-remove" data-v="'+i+'" aria-label="Remove photo '+(i+1)+'">'+ic('close')+'</button></div>'+
      '<label class="sr-only" for="alt-'+i+'">Description for photo '+(i+1)+'</label><input id="alt-'+i+'" data-alt="'+i+'" value="'+esc(f.alt||'')+'" placeholder="Add description"'+(S.settings.requireAlt&&!f.alt?' class="needs-alt"':'')+'></div>'}).join('')+'</div>':'';
}
function startUpload(f){
  var tick=function(){if(!compose||compose.files.indexOf(f)<0)return;f.p=Math.min(100,f.p+12+Math.random()*18);
    var bar=$$('#thumbs .thumb')[compose.files.indexOf(f)];var i=bar&&bar.querySelector('.thumb__prog i');
    if(f.p>=100)renderThumbs();else if(i)i.style.width=f.p+'%';
    updatePostBtn();if(f.p<100)setTimeout(tick,160)};
  setTimeout(tick,200);
}
function renderPollEdit(){
  var box=$('#poll-edit');if(!box||!compose)return;var p=compose.poll;
  if(!p){box.innerHTML='';return}
  box.innerHTML='<div class="poll-edit"><div class="poll-edit__row"><b style="flex:1">Poll</b><button class="dk-iconbtn" data-act="poll-remove" aria-label="Remove poll">'+ic('trash')+'</button></div>'+
    p.options.map(function(o,i){return '<label class="sr-only" for="po-'+i+'">Option '+(i+1)+'</label><input id="po-'+i+'" data-po="'+i+'" value="'+esc(o)+'" placeholder="Option '+(i+1)+'" maxlength="60">'}).join('')+
    (p.options.length<6?'<button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="poll-opt" style="justify-self:start">'+ic('plus')+'Add option</button>':'')+
    '<div class="chipset" role="radiogroup" aria-label="Poll length">'+[['1440','1 day'],['4320','3 days'],['10080','1 week']].map(function(x){return '<button class="dk-chip mini-chip" role="radio" aria-checked="'+(String(p.ends)===x[0])+'" aria-selected="'+(String(p.ends)===x[0])+'" data-act="poll-ends" data-v="'+x[0]+'">'+x[1]+'</button>'}).join('')+
    '<button class="dk-chip mini-chip" aria-pressed="'+p.multi+'" aria-selected="'+p.multi+'" data-act="poll-multi">Allow several answers</button></div></div>';
  updatePostBtn();
}
var AC_RE=/(^|\s)([@#])([a-z0-9]*)$/i;
function updateAC(){
  var t=$('#compose-text'),box=$('#ac');if(!t||!box||!compose)return;
  var before=t.value.slice(0,t.selectionStart),m=before.match(AC_RE);
  if(!m){compose.ac=null;box.innerHTML='';return}
  var q=m[3].toLowerCase(),items;
  if(m[2]==='@'){
    items=Object.keys(U).filter(function(k){var u=U[k];return k!=='me'&&!u.isIdent&&!u.outside&&(!q||(u.name+' '+handle(k)+' '+u.nip05).toLowerCase().indexOf(q)>=0)})
      .sort(function(a,b){return (S.follows.has(b)?1:0)-(S.follows.has(a)?1:0)}).slice(0,5).map(function(k){return {ins:'@'+handle(k)+' ',html:avatar(k)+'<span>'+esc(U[k].name)+' <small>@'+esc(handle(k))+'</small></span>'}});
  }else{
    items=TRENDING.filter(function(x){return !q||x.tag.indexOf(q)>=0}).slice(0,5).map(function(x){return {ins:'#'+x.tag+' ',html:'<span class="tagicon" style="width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--surface-raised)">'+ic('hash')+'</span><span>#'+esc(x.tag)+' <small>'+x.n+' today</small></span>'}});
    if(q&&!items.some(function(i){return i.ins==='#'+q+' '}))items.push({ins:'#'+q+' ',html:'<span class="tagicon" style="width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--surface-raised)">'+ic('hash')+'</span><span>#'+esc(q)+' <small>new tag</small></span>'});
  }
  if(!items.length){compose.ac=null;box.innerHTML='';return}
  compose.ac={items:items,start:before.length-m[2].length-m[3].length};
  compose.acIndex=Math.min(compose.acIndex||0,items.length-1);
  box.innerHTML='<div class="ac">'+items.map(function(it,i){return '<button class="ac__item" role="option" aria-selected="'+(i===compose.acIndex)+'" data-act="ac-pick" data-v="'+i+'">'+it.html+'</button>'}).join('')+'</div>';
}
function pickAC(i){
  var t=$('#compose-text');if(!t||!compose||!compose.ac)return;var it=compose.ac.items[i];
  var pos=t.selectionStart,s=compose.ac.start;
  t.value=t.value.slice(0,s)+it.ins+t.value.slice(pos);
  var np=s+it.ins.length;t.focus();t.setSelectionRange(np,np);
  compose.ac=null;compose.acIndex=0;$('#ac').innerHTML='';updatePostBtn();
}
function openDrafts(){
  var keep=compose?{text:($('#compose-text')||{}).value||''}:null;
  var list=S.drafts.map(function(d){return '<div class="draft-row"><button class="draft-open" data-act="draft-open" data-id="'+d.id+'"><b>'+esc(d.text)+'</b><span>'+ago((Date.now()-d.t)/60000)+' ago</span></button><button class="dk-iconbtn" data-act="draft-del" data-id="'+d.id+'" aria-label="Delete draft">'+ic('trash')+'</button></div>'}).join('');
  if(compose){compose.posted=true;closeSheetNow()}
  if(keep&&keep.text.trim()){saveDraft(keep.text,null);list=S.drafts.map(function(d){return '<div class="draft-row"><button class="draft-open" data-act="draft-open" data-id="'+d.id+'"><b>'+esc(d.text)+'</b><span>'+ago((Date.now()-d.t)/60000)+' ago</span></button><button class="dk-iconbtn" data-act="draft-del" data-id="'+d.id+'" aria-label="Delete draft">'+ic('trash')+'</button></div>'}).join('')}
  openSheet('<div class="sheet-stack">'+head('Drafts',true)+(list||'<p class="sheet-text">No drafts. Anything you close without posting is saved here.</p>')+'<p class="caption">Drafts are encrypted and synced to your servers (NIP-37), so they follow you between devices.</p><button class="dk-btn dk-btn--secondary dk-btn--lg" data-act="compose">'+ic('edit')+'New note</button></div>',{label:'Drafts'});
}
function openMediaServerPicker(){
  openSheet('<div class="sheet-stack">'+head('Upload media to',true)+'<div class="options">'+S.mediaServers.map(function(s,i){return '<button class="option" role="radio" aria-checked="'+(i===S.mediaServer)+'" data-act="media-server-set" data-v="'+i+'"><span class="option__icon">'+ic('server')+'</span><span><b>'+esc(s.url.replace('https://',''))+'</b><span>'+s.kind+'</span></span></button>'}).join('')+'</div><button class="dk-btn dk-btn--ghost" data-go="settings:media">Manage media servers</button></div>',{label:'Media server'});
}
doPost=function(){
  if(!compose)return;
  var t=$('#compose-text'),text=t?t.value.trim():'';
  if(!text&&!compose.files.length)return;
  if(S.settings.requireAlt&&compose.files.some(function(f){return !f.alt})){renderThumbs();toast('Add a description to each photo before posting');var na=$('.needs-alt');na&&na.focus();return}
  if(S.signer==='Remote signer'&&S.signerPerms.note==='ask'){var c=compose;openSignerWait(function(){compose=c;finishPost(text)},text);return}
  finishPost(text);
};
function finishPost(text){
  var c=compose;if(!c)return;
  var cwv=c.cw?(($('#cw-text')||{}).value||'').trim()||'Sensitive':null;
  var id='p'+Date.now();
  var n=mk(id,'me',0,text,{parent:c.replyTo,quote:c.quote,cw:cwv});
  if(c.files.length)n.gallery=c.files.map(function(f){return {m:f.src,alt:f.alt}});
  if(c.poll){var opts=c.poll.options.map(function(x){return x.trim()}).filter(Boolean);n.poll={options:opts,votes:opts.map(function(){return 0}),multi:c.poll.multi,ends:c.poll.ends}}
  if(cwv)S.revealed.add(id);
  c.files.forEach(function(f,i){S.blurDone.add(id+':'+i)});
  if(c.draftId){S.drafts=S.drafts.filter(function(d){return d.id!==c.draftId});saveDrafts()}
  c.posted=true;buildNostrMap();
  var isReply=!!c.replyTo;
  closeSheet();
  if(S.settings.offline){n.pending=true;render();toast('Saved. Dusk will send it when you\'re back online.');return}
  S.fresh.add(id);S.syncing=true;render();
  setTimeout(function(){S.syncing=false;render()},900);
  toast(isReply?'Replied':'Posted',function(){n.deleted=true;render();hideToast()});
  compose=null;
}
function openSignerWait(done,text){
  var cancelled=false;
  if(compose){compose.posted=true}
  closeSheetNow();
  openSheet('<div class="sheet-stack" style="text-align:center">'+head('Approve in your signer',true)+'<div class="spinner" aria-hidden="true"></div><p class="sheet-text">Dusk sent the note to your remote signer. Approve it there to publish.</p><button class="dk-btn dk-btn--secondary" data-act="signer-cancel">Cancel</button></div>',{label:'Waiting for signer',onClose:function(){cancelled=true}});
  window.__signerCancel=function(){cancelled=true;closeSheet();if(text){saveDraft(text,null);toast('Not posted. Your text is in drafts.')}else toast('Request cancelled')};
  setTimeout(function(){if(cancelled)return;closeSheetNow();done()},1800);
}

/* ---------- settings: new sections ---------- */
Object.assign(SET_TITLES,{lists:'Lists',set:'List',media:'Media servers',dmrelays:'Private message servers',safety:'Safety and filters',signers:'Signers',export:'Export your key',a11y:'Accessibility',app:'App and device',vanish:'Request to vanish'});
var _settingsView=V.settings;
V.settings=function(scr){
  var sec=scr.id||'root',s=S.settings,b;
  var p=sec.split(':');
  if(p[0]==='set')return setView(p[1]);
  if(EXTSET[sec])return {key:'settings:'+sec,title:SET_TITLES[sec],body:EXTSET[sec]()};
  var v=_settingsView(scr);
  if(sec==='root'){
    v.body=v.body.replace('<p class="group-help">Prototype.',
      group('Content and safety',navRow('list','Lists','Mutes, bookmarks and follow sets','lists')+navRow('image2','Media servers',S.mediaServers[S.mediaServer].url.replace('https://',''),'media')+navRow('shield','Safety and filters',{off:'No filter',fof:'Hide strangers outside your network',strict:'Only people you follow'}[s.wot],'safety'))+
      group('Messages',navRow('inbox','Private message servers',S.dmRelays.length+' servers','dmrelays'))+
      group('This device',navRow('text','Accessibility','Text size, contrast, motion, data','a11y')+navRow('phone','App and device','Install, sharing, offline','app'))+
      group('Signing',navRow('key','Signers','Extension, remote signer, Amber','signers')+navRow('download','Export your key','Encrypted backup (NIP-49)','export'))+
      group('Danger zone','<button class="dk-row row-btn" data-go="settings:vanish">'+ic('vanish')+'<span class="dk-row__text"><span class="dk-row__title" style="display:block;color:var(--clay-ink)">Request to vanish</span><span class="dk-row__sub" style="display:block">Ask servers to delete everything you posted</span></span><span class="chev">'+ic('chev')+'</span></button>')+
      '<p class="group-help">Prototype.');
  }
  if(sec==='notifications'){
    v.body=group('Push notifications',toggleRow('push','Push on this device',S.push.enabled?'On. Sent by notify.dusk.social, which watches your servers for you':'Get mentions and messages when Dusk is closed',S.push.enabled)+
      (S.push.enabled?'<div class="row-pad btnrow"><button class="dk-btn dk-btn--secondary" data-act="push-test">'+ic('bell2')+'Send a test</button></div>':''),'The push service only sees which of your notes got activity, never message contents.')+v.body;
  }
  if(sec==='account'){v.body=v.body.replace('data-act="signer"','data-go="settings:signers"')}
  return v;
};
function setView(id){
  var st=S.sets.filter(function(x){return x.id===id})[0];if(!st)return {key:'settings:set',title:'List',body:emptyHTML('List removed','')};
  var m=setMembers(st),inFeed=S.feeds.some(function(f){return f.src==='set'&&f.set===id||(id==='close'&&f.src==='close')});
  return {key:'settings:set:'+id,title:st.name,
    body:group('People',(m.length?m.map(function(k){return '<div class="person">'+avatar(k)+'<span class="person__text"><b>'+esc(U[k].name)+'</b><span>'+esc(U[k].nip05)+'</span></span><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="set-remove" data-id="'+id+'" data-v="'+k+'">Remove</button></div>'}).join(''):'<div class="row-pad caption">Nobody in this list yet.</div>'))+
      group('Add people','<div class="chipset">'+Object.keys(U).filter(function(k){return k!=='me'&&!U[k].isIdent&&!U[k].outside&&m.indexOf(k)<0}).map(function(k){return '<button class="dk-chip mini-chip" data-act="set-add" data-id="'+id+'" data-v="'+k+'">'+ic('plus')+esc(U[k].name)+'</button>'}).join('')+'</div>')+
      '<div class="row-pad btnrow" style="background:none">'+(inFeed?'<button class="dk-btn dk-btn--secondary" disabled>In your feeds</button>':'<button class="dk-btn dk-btn--secondary" data-act="set-feed" data-id="'+id+'">'+ic('list')+'Add as a feed</button>')+(id==='close'?'':'<button class="dk-btn dk-btn--danger" data-act="set-delete" data-id="'+id+'">'+ic('trash')+'Delete list</button>')+'</div>'+
      '<p class="group-help">Follow sets are public lists (NIP-51 kind 30000). Others can browse and follow them.</p>'};
}
function syncedLine(){return '<div class="synced"><span class="dot"></span><span style="flex:1">Synced to '+S.servers.filter(function(x){return x.write&&x.status!=='err'}).length+' servers · '+(S.listSync<1?'just now':ago(S.listSync)+' ago')+'</span><button class="dk-btn dk-btn--ghost dk-btn--sm" data-act="lists-sync">Sync now</button></div>'}
var EXTSET={
  lists:function(){var s=S.settings;
    return syncedLine()+
      group('Your lists',
        '<button class="dk-row row-btn" data-go="settings:muted">'+ic('mute')+'<span class="dk-row__text"><span class="dk-row__title" style="display:block">Mute list</span><span class="dk-row__sub" style="display:block">'+S.muted.size+plural(S.muted.size,' person',' people')+', '+S.mutedWords.length+plural(S.mutedWords.length,' word',' words')+' · '+(s.muteListPrivate?'private':'public')+'</span></span><span class="chev">'+ic('chev')+'</span></button>'+
        toggleRow('muteListPrivate','Keep mute list private','Encrypted so only you can read it. Others can\'t see who you mute.',s.muteListPrivate)+
        '<button class="dk-row row-btn" data-act="go-bookmarks">'+ic('bookmark')+'<span class="dk-row__text"><span class="dk-row__title" style="display:block">Bookmarks</span><span class="dk-row__sub" style="display:block">'+S.bookmarks.size+' notes · private</span></span><span class="chev">'+ic('chev')+'</span></button>')+
      group('Follow sets',S.sets.map(function(st){var m=setMembers(st);return '<button class="dk-row row-btn" data-go="settings:set:'+st.id+'"><span class="avstack" style="min-width:44px">'+m.slice(0,3).map(function(k){return avatar(k)}).join('')+'</span><span class="dk-row__text"><span class="dk-row__title" style="display:block">'+esc(st.name)+'</span><span class="dk-row__sub" style="display:block">'+m.length+plural(m.length,' person',' people')+'</span></span><span class="chev">'+ic('chev')+'</span></button>'}).join('')+
        '<form class="inline-form" data-form="newset"><div class="dk-field"><label class="sr-only" for="newset">List name</label><input id="newset" placeholder="New list, like Climbing friends" autocomplete="off"></div><button class="dk-btn dk-btn--secondary" type="submit">Create</button></form>',
        'Lists live on your servers (NIP-51), so every Nostr app you use sees the same ones.');
  },
  media:function(){
    return group('Upload to',S.mediaServers.map(function(s,i){return '<div class="dk-row"><span class="dk-row__text"><span class="dk-row__title" style="display:block">'+esc(s.url.replace('https://',''))+'</span><span class="dk-row__sub" style="display:block">'+s.kind+(i===S.mediaServer?' · default':'')+'</span></span>'+(i===S.mediaServer?'<span class="pill-active">'+ic('check')+'Default</span>':'<button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="media-server-set" data-v="'+i+'">Use</button>')+'<button class="dk-iconbtn" data-act="media-del" data-v="'+i+'" aria-label="Remove server"'+(S.mediaServers.length<2?' disabled':'')+'>'+ic('trash')+'</button></div>'}).join('')+
      '<form class="inline-form" data-form="mediasrv"><div class="dk-field" id="ms-field"><label class="sr-only" for="ms-input">Server address</label><input id="ms-input" placeholder="https://media.example.com" autocomplete="off" inputmode="url"><span class="dk-field__help" id="ms-help" hidden></span></div><button class="dk-btn dk-btn--secondary" type="submit">Add</button></form>',
      'Dusk uploads to your default server and mirrors to the others (Blossom), so your media survives if one goes away. The list is published so other apps use it too.');
  },
  dmrelays:function(){
    return group('Inbox servers',S.dmRelays.map(function(r,i){return '<div class="dk-row"><span class="dk-row__text"><span class="key" style="color:var(--ink)">'+esc(r)+'</span><span class="dk-row__sub" style="display:block">Requires sign-in to read · <span class="status status--ok"><i></i>Connected</span></span></span><button class="dk-iconbtn" data-act="dmrelay-del" data-v="'+i+'" aria-label="Remove '+esc(r)+'"'+(S.dmRelays.length<2?' disabled':'')+'>'+ic('trash')+'</button></div>'}).join('')+
      '<form class="inline-form" data-form="dmrelay"><div class="dk-field" id="dr-field"><label class="sr-only" for="dr-input">Server address</label><input id="dr-input" placeholder="wss://inbox.example.com" autocomplete="off"><span class="dk-field__help" id="dr-help" hidden></span></div><button class="dk-btn dk-btn--secondary" type="submit">Add</button></form>',
      'People send your private messages here (kind 10050). Pick servers that only let you read your own inbox.');
  },
  safety:function(){var s=S.settings;
    return group('Who can reach you',chipset('wot',[['off','Everyone'],['fof','Your network'],['strict','People you follow']],s.wot),
      {off:'No filtering. Replies, mentions and message requests from anyone show up.',fof:'Replies, mentions and message requests from people outside your follows and their follows are hidden behind a “Show” button.',strict:'Only people you follow show up. Everything else is hidden behind a “Show” button.'}[s.wot])+
      group('Reports',S.reported.size?'<div class="row-pad caption">You reported '+S.reported.size+plural(S.reported.size,' note',' notes')+'. Reports are public (NIP-56) and help others filter.</div>':'<div class="row-pad caption">No reports yet. Use “Report” in a note\'s options.</div>')+
      group('Muted threads',S.mutedThreads.size?Array.from(S.mutedThreads).map(function(id){var n=N[id];return '<div class="dk-row"><span class="dk-row__text"><span class="dk-row__title" style="display:block">'+esc(U[n.author].name)+'</span><span class="dk-row__sub" style="display:block">'+esc(n.text.slice(0,60))+'</span></span><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="mute-thread" data-id="'+id+'">Unmute</button></div>'}).join(''):'<div class="row-pad caption">No muted threads.</div>');
  },
  signers:function(){
    var remote=S.signer==='Remote signer',perm=function(k,label,kind){return '<div class="perm-row"><span class="dk-row__title">'+label+' <span class="caption">kind '+kind+'</span></span>'+chipset('perm.'+k,[['always','Always allow'],['ask','Ask each time'],['never','Never']],S.signerPerms[k])+'</div>'};
    var hasExt=!!(window.nostr&&window.nostr.getPublicKey);
    return group('Signing with',
      '<button class="option" role="radio" aria-checked="'+(S.signer==='Browser extension')+'" data-act="signer-pick" data-v="ext" style="border-radius:0;border-width:0 0 1px"><span class="option__icon">'+ic('server')+'</span><span style="flex:1"><b>Browser extension (NIP-07)</b><span>'+(hasExt||S.extDetected?'Detected on this browser':'Not detected on this browser')+'</span></span></button>'+
      '<button class="option" role="radio" aria-checked="'+remote+'" data-act="signer-pick" data-v="bunker" style="border-radius:0;border-width:0 0 1px"><span class="option__icon">'+ic('key')+'</span><span style="flex:1"><b>Remote signer (NIP-46)</b><span>'+(remote?'Connected · bunker on your phone':'Keep your key on another device')+'</span></span></button>'+
      '<button class="option" role="radio" aria-checked="'+(S.signer==='Amber')+'" data-act="signer-pick" data-v="amber" style="border-radius:0;border-width:0 0 1px"><span class="option__icon">'+ic('phone')+'</span><span style="flex:1"><b>Amber on Android (NIP-55)</b><span>Signs in a separate app on this phone</span></span></button>'+
      '<button class="option" role="radio" aria-checked="'+(S.signer==='Key on this device')+'" data-act="signer-pick" data-v="local" style="border-radius:0;border-width:0"><span class="option__icon">'+ic('lock')+'</span><span style="flex:1"><b>Key on this device</b><span>Encrypted and unlocked with your passkey</span></span></button>')+
      (remote?group('What Dusk may sign without asking',perm('note','Post notes',1)+perm('react','Reactions',7)+perm('dm','Private messages',14)+perm('zap','Zap requests',9734)+perm('profile','Profile changes',0),'Your signer app enforces these too. “Ask each time” shows a prompt in your signer.')+
        '<div class="row-pad btnrow" style="background:none"><button class="dk-btn dk-btn--secondary" data-act="signer-test">Send a test request</button><button class="dk-btn dk-btn--danger" data-act="signer-disconnect">Disconnect</button></div>':'');
  },
  export:function(){
    if(S.signer!=='Key on this device')return '<div class="empty"><h2>Your key isn\'t here</h2><p>You sign with '+esc(S.signer.toLowerCase())+', so the private key never touches Dusk. Export it from that app instead.</p><button class="dk-btn dk-btn--secondary" data-go="settings:signers">Change how you sign</button></div>';
    return '<div class="row-pad" style="background:none"><form class="sheet-stack" data-form="ncrypt"><p class="sheet-text">Dusk encrypts your private key with a password (NIP-49). You get an ncryptsec string that any Nostr app can import with the same password.</p>'+
      '<div class="dk-field"><label class="dk-field__label" for="nc-pass">Password</label><input id="nc-pass" type="password" autocomplete="new-password"><div class="meter" aria-hidden="true"><i id="nc-meter" style="width:0"></i></div><span class="dk-field__help" id="nc-help">At least 10 characters. A few random words work well.</span></div>'+
      '<div class="dk-field" id="nc2-field"><label class="dk-field__label" for="nc-pass2">Repeat password</label><input id="nc-pass2" type="password" autocomplete="new-password"><span class="dk-field__help" id="nc2-help" hidden></span></div>'+
      '<button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">Create encrypted key</button></form><div id="nc-out"></div></div>';
  },
  a11y:function(){var s=S.settings;
    return group('Text size','<div class="range-row"><label class="sr-only" for="ts-range">Text size</label><input type="range" id="ts-range" min="0.9" max="1.4" step="0.05" value="'+s.textScale+'"><div class="range-row__labels"><span>Smaller</span><span id="ts-val">'+Math.round(s.textScale*100)+'%</span><span>Larger</span></div></div>')+
      group('Seeing',toggleRow('contrast','Higher contrast','Stronger text and dividers',s.contrast)+toggleRow('reduceMotion','Reduce motion','Turn off animations in Dusk, whatever the system says',s.reduceMotion))+
      group('Images',toggleRow('requireAlt','Remind me to describe photos','Ask for a description before posting a photo without one',s.requireAlt))+
      group('Data',toggleRow('dataSaver','Data saver','Load images and video only when you tap them'+(navigator.connection&&navigator.connection.type==='cellular'?' · on mobile data now':''),s.dataSaver))+
      group('Gestures','<div class="row-pad caption">Every swipe has a button on the note, and long-press has the ⋯ menu. Screen readers get each action as a labelled button.</div>');
  },
  app:function(){
    var standalone=matchMedia('(display-mode: standalone)').matches,p=pendingCount();
    return group('Install',standalone?'<div class="row-pad caption">Dusk is installed on this device.</div>':
      '<div class="row-pad" style="display:grid;gap:12px"><span class="caption">Install Dusk to open it from your home screen, get push notifications and share into it from other apps.</span><span class="caption"><b>iPhone and iPad:</b> Share › Add to Home Screen. <b>Android and desktop:</b> the install button in your browser\'s menu or address bar.</span></div>')+
      group('Sharing into Dusk','<div class="row-pad" style="display:grid;gap:12px"><span class="caption">Once installed, Dusk shows up in your phone\'s share menu. Shared links and photos open a new note.</span><button class="dk-btn dk-btn--secondary" data-act="share-demo">'+ic('share2')+'Try it: share a link</button></div>')+
      group('nostr: links','<form class="inline-form" data-form="nostrlink"><div class="dk-field" id="nl-field"><label class="sr-only" for="nl-input">nostr: link</label><input id="nl-input" class="key" placeholder="nostr:npub1… or nostr:nevent1…" autocomplete="off" spellcheck="false"><span class="dk-field__help" id="nl-help">Dusk opens nostr: links from anywhere on this device.</span></div><button class="dk-btn dk-btn--secondary" type="submit">Open</button></form>'+
        '<div class="chipset">'+[['Ada\'s profile','nostr:'+U.ada.npub],['A note','nostr:'+NEV('n9')],['An article','nostr:'+NADDR('a1')]].map(function(x){return '<button class="dk-chip mini-chip" data-act="nostr-open" data-v="'+x[1]+'">'+x[0]+'</button>'}).join('')+'</div>')+
      group('Offline','<div class="dk-row"><span class="dk-row__text"><span class="dk-row__title" style="display:block">Saved on this device</span><span class="dk-row__sub" style="display:block" id="cache-size">'+(S.cacheCleared?'Nothing yet':'1,240 notes · 38 MB of media')+'</span></span><button class="dk-btn dk-btn--secondary dk-btn--sm" data-act="cache-clear"'+(S.cacheCleared?' disabled':'')+'>Clear</button></div>'+
        '<div class="dk-row"><span class="dk-row__text"><span class="dk-row__title" style="display:block">Waiting to send</span><span class="dk-row__sub" style="display:block">'+(p?p+plural(p,' note',' notes')+' will send when you\'re back online':'Nothing waiting')+'</span></span></div>','Dusk keeps recent notes so you can read without a connection, and queues what you post.');
  },
  vanish:function(){
    return '<div class="row-pad" style="background:none"><form class="sheet-stack" data-form="vanish"><div class="warn">'+ic('warn')+'<span>This asks servers to delete every note, reaction and message you posted, and to refuse anything new from this key. It can\'t be undone. Copies elsewhere may stay.</span></div>'+
      '<div class="report-opts" role="radiogroup" aria-label="Where">'+[['all','All servers','Every server, including ones you don\'t use'],['mine','Only my servers',S.servers.length+' servers in your list']].map(function(o,i){return '<button type="button" class="report-opt" role="radio" aria-checked="'+(i===0)+'" data-act="vanish-scope" data-v="'+o[0]+'"><span style="display:grid"><b>'+o[1]+'</b><span class="caption">'+o[2]+'</span></span></button>'}).join('')+'</div>'+
      '<div class="dk-field"><label class="dk-field__label" for="vanish-confirm">Type <b>vanish</b> to confirm</label><input id="vanish-confirm" autocomplete="off" autocapitalize="off"></div>'+
      '<button class="dk-btn dk-btn--danger dk-btn--lg" type="submit" id="vanish-btn" disabled>Request to vanish</button></form></div>';
  }
};

/* ---------- report, mute thread: extend note sheet ---------- */
var _noteSheetHTML=noteSheetHTML;
noteSheetHTML=function(id){
  var h=_noteSheetHTML(id),n=N[id],root=rootOf(id),muted=S.mutedThreads.has(root);
  var extra='<li><button class="dk-menu__item row-btn" data-act="react-pick" data-id="'+id+'">'+ic('smile')+'React with emoji</button></li>'+
    '<li><button class="dk-menu__item row-btn" data-act="mute-thread" data-id="'+id+'">'+ic('mute')+(muted?'Unmute this thread':'Mute this thread')+'</button></li>'+
    (n.author!=='me'?'<li><button class="dk-menu__item dk-menu__item--danger row-btn" data-act="report" data-id="'+id+'">'+ic('flag')+(S.reported.has(id)?'Reported':'Report')+'</button></li>':'');
  return h.replace('</ul>',extra+'</ul>');
};
var REPORT_TYPES=[['spam','Spam','Scams, ads, repeated posts'],['impersonation','Impersonation','Pretends to be someone else'],['nudity','Nudity','Explicit images without a warning'],['illegal','Illegal','Breaks the law where you live'],['other','Something else','Tell us more below']];
function openReport(id){
  var n=N[id];
  openSheet('<form class="sheet-stack" data-form="report" data-id="'+id+'">'+head('Report this note',true)+'<p class="sheet-text">Reports are published (NIP-56) so clients and relays can filter. '+esc(U[n.author].name)+' can see that a report exists.</p>'+
    '<div class="report-opts" role="radiogroup" aria-label="Reason">'+REPORT_TYPES.map(function(r,i){return '<button type="button" class="report-opt" role="radio" aria-checked="'+(i===0)+'" data-act="report-type" data-v="'+r[0]+'"><span style="display:grid"><b>'+r[1]+'</b><span class="caption">'+r[2]+'</span></span></button>'}).join('')+'</div>'+
    '<div class="dk-field"><label class="dk-field__label" for="report-note">Details <span class="caption">(optional)</span></label><input id="report-note" autocomplete="off"></div>'+
    '<label class="check"><input type="checkbox" id="report-mute" checked> Also mute @'+esc(handle(n.author))+'</label>'+
    '<button class="dk-btn dk-btn--danger dk-btn--lg" type="submit">'+ic('flag')+'Send report</button></form>',{label:'Report'});
}

/* ---------- signers: extra flows ---------- */
function openBunkerConnect(){
  var uri='nostrconnect://'+rnd('nc'+Date.now(),64,HEX)+'?relay=wss://relay.nsec.app&name=Dusk';
  openSheet('<div class="sheet-stack">'+head('Connect a remote signer',true)+'<p class="sheet-text">Scan this with your signer app, or paste a bunker:// link from it.</p><div class="qr" id="qr"></div>'+
    '<form class="sheet-stack" data-form="bunker"><div class="dk-field" id="bk-field"><label class="dk-field__label" for="bk-input">Or paste a connection</label><input id="bk-input" class="key" placeholder="bunker://…" autocomplete="off" spellcheck="false"><span class="dk-field__help" id="bk-help">Your signer shows this as “Connect an app”.</span></div><button class="dk-btn dk-btn--primary dk-btn--lg" type="submit">Connect</button></form>'+
    '<button class="dk-btn dk-btn--ghost" data-act="bunker-demo">Use a demo signer</button></div>',{label:'Remote signer'});
  try{new QRCode($('#qr'),{text:uri,width:200,height:200,colorDark:'#14151a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.L})}catch(e){$('#qr').innerHTML='<p class="caption" style="color:#14151a;width:200px">QR code unavailable here.</p>'}
}
function openAmber(){
  openSheet('<div class="sheet-stack">'+head('Sign with Amber',true)+'<p class="sheet-text">Amber keeps your key in a separate Android app. Dusk asks Amber to sign each note, and Amber shows you what it\'s signing.</p><button class="dk-btn dk-btn--primary dk-btn--lg" data-act="amber-go">'+ic('phone')+'Open Amber</button><p class="caption">Only works in Dusk on Android. On other devices, use a remote signer.</p></div>',{label:'Amber'});
}

/* ---------- push ---------- */
function osNotify(title,text,go){
  var el=$('#osn');if(!el){el=document.createElement('div');el.id='osn';document.body.appendChild(el)}
  el.innerHTML='<button class="osn" data-osn="'+(go||'')+'"><span class="osn__icon" aria-hidden="true"></span><span><b>'+esc(title)+'</b><span>'+esc(text)+'</span></span><small>now</small></button>';
  requestAnimationFrame(function(){el.classList.add('is-on')});
  clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove('is-on')},5000);
}
document.addEventListener('click',function(e){var b=e.target.closest('[data-osn]');if(!b)return;$('#osn').classList.remove('is-on');if(b.dataset.osn)goTo(b.dataset.osn)});
function openPushAsk(){
  openSheet('<div class="sheet-stack">'+head('Turn on push notifications',true)+'<p class="sheet-text">Dusk uses a small service that watches your servers and wakes your device for mentions, replies and messages. It never sees message contents.</p>'+
    '<div class="group" style="border-radius:14px;overflow:hidden">'+['Mentions and replies','Private messages','Zaps'].map(function(x){return '<div class="dk-row">'+ic('check')+'<span class="dk-row__text">'+x+'</span></div>'}).join('')+'</div>'+
    '<button class="dk-btn dk-btn--primary dk-btn--lg" data-act="push-allow">Allow notifications</button><button class="dk-btn dk-btn--ghost" data-close>Not now</button></div>',{label:'Push notifications'});
}

/* ---------- act wrapper ---------- */
var _actFn=act;
act=function(k,el,e){
  var id=el.dataset.id,v=el.dataset.v,s=S.settings;
  switch(k){
    case 'react':toggleReact(id,v);return;
    case 'react-pick':closeSheetNow();openReactPicker(id);return;
    case 'react-choose':closeSheet();var m=S.myReacts[id]=S.myReacts[id]||{};if(!m[v]){m[v]=1;rememberEmoji(v)}render();toast('Reacted '+(v[0]===':'?v:v));return;
    case 'reactors':openReactors(id);return;
    case 'gallery':openGallery(id,+v);return;
    case 'media':openGallery(id,0);return;
    case 'lb-step':openGallery(id,+v);return;
    case 'alt':openSheet('<div class="sheet-stack">'+head('Image description',true)+'<p class="sheet-text">'+esc(v)+'</p></div>',{label:'Image description'});return;
    case 'load-media':S.loaded.add(v);S.blurDone.delete(v);render();return;
    case 'video':if(S.playing.has(id))S.playing.delete(id);else S.playing.add(id);render();return;
    case 'vote':if(S.votes[id]!=null)return;S.votes[id]=+v;render();toast('Vote counted');return;
    case 'rsvp':S.rsvp[id]=S.rsvp[id]===v?null:v;render();if(S.rsvp[id])toast({going:'You\'re going',maybe:'Marked as maybe',no:'Marked as can\'t go'}[v]);return;
    case 'badge':openBadge(id,v);return;
    case 'badge-toggle':(USER_BADGES.me||[]).forEach(function(x){if(x.b===v)x.ok=!x.ok});closeSheet();render();toast('Badges updated');return;
    case 'qr':openQR(id);return;
    case 'zap-profile':var lastN=topNotes().filter(function(n){return n.author===id}).sort(function(a,b){return a.t-b.t})[0];if(lastN)noteAction('zap',lastN.id,'button');return;
    case 'conn-tab':S.stack[S.stack.length-1]={type:'connections',id:id+':'+v,pushed:true};render();return;
    case 'dm-tab':S.dmTab=v;render();return;
    case 'dm-show-filtered':S.settings.wot='off';saveSettings();render();toast('Showing all requests. Change this in Safety and filters.');return;
    case 'dm-accept':CONVS[id].request=false;S.dmTab='chats';render();toast('Moved to Chats');return;
    case 'dm-delete':CONVS[id].muted=true;pop();toast('Request deleted');return;
    case 'dm-block':S.muted.add(CONVS[id].with);CONVS[id].muted=true;pop();toast('Blocked @'+handle(CONVS[id].with));return;
    case 'bubble':S.bubbleBar=S.bubbleBar===id?null:id;render();return;
    case 'bubble-react':var pp=id.split(':'),msg=CONVS[pp[0]].msgs[+pp[1]];msg.react=msg.react===v?null:v;S.bubbleBar=null;render();return;
    case 'chat-attach':fileTarget='chat:'+id;$('#file').removeAttribute('multiple');$('#file').click();return;
    case 'attach':fileTarget='compose';$('#file').setAttribute('multiple','');$('#file').click();return;
    case 'thumb-remove':compose.files.splice(+v,1);renderThumbs();updatePostBtn();return;
    case 'poll-add':if(!compose.poll){compose.poll={options:['',''],multi:false,ends:1440};renderPollEdit();var po=$('#po-0');po&&po.focus()}return;
    case 'poll-remove':compose.poll=null;renderPollEdit();updatePostBtn();return;
    case 'poll-opt':compose.poll.options.push('');renderPollEdit();var last=$('#po-'+(compose.poll.options.length-1));last&&last.focus();return;
    case 'poll-ends':compose.poll.ends=+v;renderPollEdit();return;
    case 'poll-multi':compose.poll.multi=!compose.poll.multi;renderPollEdit();return;
    case 'ac-pick':pickAC(+v);return;
    case 'mention':var ta=$('#compose-text');if(ta){var p=ta.selectionStart||ta.value.length;var ins=(p&&!/\s$/.test(ta.value.slice(0,p))?' @':'@');ta.value=ta.value.slice(0,p)+ins+ta.value.slice(p);ta.focus();ta.setSelectionRange(p+ins.length,p+ins.length);updateAC();updatePostBtn()}return;
    case 'drafts':openDrafts();return;
    case 'draft-open':var d=S.drafts.filter(function(x){return x.id===id})[0];closeSheetNow();openCompose({text:d.text,draftId:d.id});return;
    case 'draft-del':S.drafts=S.drafts.filter(function(x){return x.id!==id});saveDrafts();closeSheetNow();openDrafts();return;
    case 'media-server':openMediaServerPicker();return;
    case 'media-server-set':S.mediaServer=+v;if(sheetState){closeSheet()}render();toast('Uploading to '+S.mediaServers[+v].url.replace('https://',''));return;
    case 'media-del':var rmS=S.mediaServers.splice(+v,1)[0];if(S.mediaServer>=S.mediaServers.length||S.mediaServer===+v)S.mediaServer=0;render();toast('Removed '+rmS.url.replace('https://',''));return;
    case 'dmrelay-del':var rr=S.dmRelays.splice(+v,1)[0];render();toast('Removed '+rr.replace('wss://',''));return;
    case 'go-bookmarks':S.profileTab.me='bookmarks';if(wide())push({type:'profile',id:'me'});else{S.stack=[];setTab('me')}return;
    case 'lists-sync':S.listSync=0;render();toast('Lists synced');return;
    case 'set-add':var st=S.sets.filter(function(x){return x.id===id})[0];if(id==='close')S.close.add(v);else st.members.push(v);render();return;
    case 'set-remove':var st2=S.sets.filter(function(x){return x.id===id})[0];if(id==='close')S.close.delete(v);else st2.members=st2.members.filter(function(x){return x!==v});render();return;
    case 'set-feed':var st3=S.sets.filter(function(x){return x.id===id})[0];S.feeds.push(id==='close'?{id:'f'+Date.now(),name:st3.name,src:'close'}:{id:'f'+Date.now(),name:st3.name,src:'set',set:id});saveFeeds();render();toast('Added '+st3.name+' to your feeds');return;
    case 'set-delete':S.sets=S.sets.filter(function(x){return x.id!==id});pop();toast('List deleted');return;
    case 'pack':openPack(id);return;
    case 'pack-follow':var pk=PACKS.filter(function(x){return x.id===id})[0];pk.members.forEach(function(m){S.follows.add(m)});closeSheet();render();refreshSearch();toast('Following '+pk.members.length+' people');return;
    case 'mute-thread':var root=rootOf(id);if(S.mutedThreads.has(root)){S.mutedThreads.delete(root);toast('Thread unmuted')}else{S.mutedThreads.add(root);toast('Thread muted',function(){S.mutedThreads.delete(root);render()})}closeSheetNow();render();return;
    case 'report':closeSheetNow();openReport(id);return;
    case 'report-type':case 'vanish-scope':$$('[data-act="'+k+'"]',el.closest('form')).forEach(function(b){b.setAttribute('aria-checked',b===el)});return;
    case 'show-hidden':if(S.showHidden.has(id))S.showHidden.delete(id);else S.showHidden.add(id);render();return;
    case 'signer-pick':if(v==='bunker'){openBunkerConnect();return}if(v==='amber'){openAmber();return}
      if(v==='ext'){var has=!!(window.nostr&&window.nostr.getPublicKey);if(!has){openSheet('<div class="sheet-stack">'+head('No extension found',true)+'<p class="sheet-text">Dusk couldn\'t find a Nostr signing extension in this browser. Install one such as Alby or nos2x, then try again.</p><div class="btnrow"><button class="dk-btn dk-btn--secondary" data-act="ext-retry">Try again</button><button class="dk-btn dk-btn--ghost" data-act="ext-demo">Use a demo extension</button></div></div>',{label:'Extension'});return}S.signer='Browser extension';render();return}
      if(v==='local'){S.signer='Key on this device';render();toast('Signing with the key on this device');return}return;
    case 'ext-retry':toast(window.nostr?'Extension found':'Still no extension in this browser');return;
    case 'ext-demo':S.extDetected=true;S.signer='Browser extension';closeSheet();render();toast('Signing with your browser extension');return;
    case 'bunker-demo':S.signer='Remote signer';closeSheet();render();toast('Connected to your remote signer');return;
    case 'amber-go':S.signer='Amber';closeSheet();render();toast('Signing with Amber');return;
    case 'signer-test':openSignerWait(function(){toast('Your signer approved the test')});return;
    case 'signer-cancel':window.__signerCancel&&window.__signerCancel();return;
    case 'signer-disconnect':S.signer='Key on this device';render();toast('Disconnected remote signer');return;
    case 'push-allow':S.push.enabled=true;closeSheet();try{if(window.Notification&&Notification.requestPermission)Notification.requestPermission().catch(function(){})}catch(err){}render();toast('Push notifications on');return;
    case 'push-test':osNotify('Mira Tal mentioned you','@tolga would Dusk support long-form drafts?','thread:n19');return;
    case 'share-demo':closeSheetNow();openCompose({text:'Worth reading: https://amari.studio/notes/small-screens ',shared:'Safari'});return;
    case 'nostr-open':openNostrLink(v);return;
    case 'cache-clear':S.cacheCleared=true;render();toast('Offline cache cleared');return;
    case 'compose':closeSheetNow();openCompose({});return;
  }
  if(k==='more'){openNoteSheet(id);render();return}
  return _actFn(k,el,e);
};
function openNostrLink(v){
  var s=(v||'').trim().replace(/^nostr:/,''),o=NOSTR_MAP[s];
  if(!o){var h=$('#nl-help'),f=$('#nl-field');if(h){f.classList.add('dk-field--error');h.textContent='Dusk couldn\'t find that. Check that it starts with nostr:npub1, nostr:nevent1 or nostr:naddr1.'}else toast('That link isn\'t one Dusk knows');return false}
  goTo({user:'profile',note:'thread',article:'article'}[o.t]+':'+o.id);return true;
}

/* ---------- long-press on like opens the reaction picker ---------- */
(function(){
  var t=null,target=null;
  document.addEventListener('pointerdown',function(e){var b=e.target.closest('.is-like[data-act="like"]');if(!b)return;target=b;t=setTimeout(function(){suppressClick=true;try{navigator.vibrate&&navigator.vibrate(8)}catch(err){}openReactPicker(b.dataset.id);t=null},450)},true);
  ['pointerup','pointercancel','pointerleave'].forEach(function(ev){document.addEventListener(ev,function(){if(t){clearTimeout(t);t=null}},true)});
  document.addEventListener('contextmenu',function(e){var b=e.target.closest('.is-like[data-act="like"]');if(b){e.preventDefault();e.stopPropagation();openReactPicker(b.dataset.id)}},true);
})();

/* ---------- inputs ---------- */
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='file'&&(fileTarget==='compose'||fileTarget.indexOf('chat:')===0||fileTarget==='banner')){
    e.stopPropagation();
    var files=Array.prototype.slice.call(t.files||[]);t.value='';if(!files.length)return;
    if(fileTarget==='banner'){var rb=new FileReader();rb.onload=function(){U.me.bannerSrc=rb.result;var pb=$('.pbanner',layer);if(pb){pb.style.background='center/cover url('+rb.result+')'}render();toast('Banner updated')};rb.readAsDataURL(files[0]);return}
    if(fileTarget.indexOf('chat:')===0){var cid=fileTarget.slice(5),rc=new FileReader();rc.onload=function(){CONVS[cid].msgs.push({f:'me',img:rc.result,x:'',t:0});render()};rc.readAsDataURL(files[0]);return}
    if(!compose)return;
    files.slice(0,4-compose.files.length).forEach(function(file){var r=new FileReader();r.onload=function(){if(!compose)return;var f={src:r.result,alt:'',p:0};compose.files.push(f);renderThumbs();updatePostBtn();startUpload(f)};r.readAsDataURL(file)});
    if(files.length>4-compose.files.length)toast('Up to 4 photos per note');
    return;
  }
  if(t.dataset.toggle){
    var k=t.dataset.toggle;
    if(k==='push'){e.stopPropagation();if(t.checked){t.checked=false;openPushAsk()}else{S.push.enabled=false;render();toast('Push notifications off')}return}
    if(['contrast','reduceMotion','dataSaver','requireAlt','muteListPrivate'].indexOf(k)>=0){e.stopPropagation();S.settings[k]=t.checked;saveSettings();applySettings();render();if(k==='muteListPrivate')toast(t.checked?'Mute list is now private':'Mute list is now public');return}
  }
},true);
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.id==='compose-text'){updateAC();return}
  if(t.dataset.alt!=null&&compose){compose.files[+t.dataset.alt].alt=t.value;t.classList.remove('needs-alt');return}
  if(t.dataset.po!=null&&compose&&compose.poll){compose.poll.options[+t.dataset.po]=t.value;updatePostBtn();return}
  if(t.id==='emoji-q'){openReactPicker(t.dataset.id,t.value);return}
  if(t.id==='ts-range'){S.settings.textScale=+t.value;saveSettings();applySettings();var tv=$('#ts-val');if(tv)tv.textContent=Math.round(t.value*100)+'%';return}
  if(t.id==='vanish-confirm'){$('#vanish-btn').disabled=t.value.trim().toLowerCase()!=='vanish';return}
  if(t.id==='nc-pass'){var sc=Math.min(100,t.value.length*7+(/[^a-z]/i.test(t.value)?15:0)+(/\s/.test(t.value)?15:0)),m=$('#nc-meter');m.style.width=sc+'%';m.style.background=sc<50?'var(--clay)':sc<80?'var(--butter)':'var(--sage)';$('#nc-help').textContent=sc<50?'Too weak. Use 10 or more characters.':sc<80?'Okay. Longer is better.':'Strong';return}
  if(t.id==='live-input'||t.id==='chat-input'){t.style.height='auto';t.style.height=Math.min(140,t.scrollHeight)+'px'}
});
document.addEventListener('keydown',function(e){
  var t=e.target;
  if(t.id==='compose-text'&&compose&&compose.ac){
    var n=compose.ac.items.length;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();compose.acIndex=(compose.acIndex+(e.key==='ArrowDown'?1:n-1))%n;updateAC();return}
    if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();e.stopPropagation();pickAC(compose.acIndex);return}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();compose.ac=null;$('#ac').innerHTML='';return}
  }
  if(t.id==='live-input'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();var f=t.closest('form');f&&f.requestSubmit&&f.requestSubmit();return}
},true);
document.addEventListener('submit',function(e){
  var f=e.target,kind=f.dataset.form;if(!kind)return;
  var handled=true;
  switch(kind){
    case 'livechat':var li=$('#live-input'),x=li.value.trim();if(x){var m={f:'me',x:x};LIVECHAT.push(m);$('#livechat').insertAdjacentHTML('beforeend',liveMsg(m));li.value='';var sc=f.closest('.screen').querySelector('.scroller');sc.scrollTop=sc.scrollHeight}break;
    case 'newset':var nm=$('#newset').value.trim();if(!nm){$('#newset').focus();break}var sid='s'+Date.now();S.sets.push({id:sid,name:nm,members:[]});push({type:'settings',id:'set:'+sid});toast('Created '+nm);break;
    case 'mediasrv':var mi=$('#ms-input'),url=mi.value.trim().replace(/\/$/,'');if(!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)){$('#ms-field').classList.add('dk-field--error');var mh=$('#ms-help');mh.hidden=false;mh.textContent='Use an address that starts with https://';mi.focus();break}S.mediaServers.push({url:url,kind:'Blossom'});render();toast('Added '+url.replace('https://',''));break;
    case 'dmrelay':var di=$('#dr-input'),du=di.value.trim();if(!/^wss:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(du)){$('#dr-field').classList.add('dk-field--error');var dh=$('#dr-help');dh.hidden=false;dh.textContent='Use an address that starts with wss://';di.focus();break}S.dmRelays.push(du);render();toast('Added '+du.replace('wss://',''));break;
    case 'report':var rid=f.dataset.id,rt=$('[data-act="report-type"][aria-checked="true"]',f).dataset.v;S.reported.add(rid);if($('#report-mute').checked)S.muted.add(N[rid].author);closeSheet();render();toast('Reported as '+REPORT_TYPES.filter(function(r){return r[0]===rt})[0][1].toLowerCase()+'. Thanks.');break;
    case 'bunker':var bi=$('#bk-input'),bv=bi.value.trim();if(!/^bunker:\/\/[0-9a-f]{64}/i.test(bv)&&!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(bv)){$('#bk-field').classList.add('dk-field--error');$('#bk-help').textContent='Paste a bunker:// link from your signer, or an address like name@provider.com';bi.focus();break}S.signer='Remote signer';closeSheet();render();toast('Connected to your remote signer');break;
    case 'ncrypt':var p1=$('#nc-pass').value,p2=$('#nc-pass2').value;
      if(p1.length<10){$('#nc-help').textContent='Use at least 10 characters.';$('#nc-pass').focus();break}
      if(p1!==p2){$('#nc2-field').classList.add('dk-field--error');var h2=$('#nc2-help');h2.hidden=false;h2.textContent='The passwords don\'t match.';$('#nc-pass2').focus();break}
      var enc='ncryptsec1'+rnd('ncs'+p1+Date.now(),150,B32);
      $('#nc-out').innerHTML='<div class="sheet-stack" style="margin-top:24px"><div class="dk-field__label">Your encrypted key</div><div class="ncrypt key">'+enc+'</div><button class="dk-btn dk-btn--secondary" data-act="copy" data-copy="'+enc+'" data-msg="Copied encrypted key">'+ic('copy')+'Copy</button><p class="caption">Keep this and your password in different places. Either one alone can\'t open your account.</p></div>';
      f.reset();$('#nc-meter').style.width='0';break;
    case 'nostrlink':openNostrLink($('#nl-input').value);break;
    case 'vanish':closeSheetNow();toast('Vanish request sent to '+(($('[data-act="vanish-scope"][aria-checked="true"]',f)||{dataset:{v:'all'}}).dataset.v==='all'?'all servers':S.servers.length+' servers'));setTimeout(openOnboarding,900);break;
    case 'profile':var w=$('#pf-web'),l=$('#pf-lud');if(w)U.me.website=w.value.trim().replace(/^https?:\/\//,'');if(l)U.me.lud16=l.value.trim();handled=false;break;
    default:handled=false;
  }
  if(handled){e.preventDefault();e.stopPropagation()}
},true);

/* ---------- settings: chipset keys for new settings ---------- */
var _setSetting=setSetting;
setSetting=function(k,v){
  if(k.indexOf('perm.')===0){S.signerPerms[k.slice(5)]=v;render();return}
  if(k==='wot'){S.settings.wot=v;saveSettings();render();return}
  _setSetting(k,v);
};

/* ---------- apply a11y settings ---------- */
var _applySettings=applySettings;
applySettings=function(){
  _applySettings();var h=document.documentElement,s=S.settings;
  h.style.setProperty('--ts',s.textScale||1);
  if(s.contrast)h.setAttribute('data-contrast','high');else h.removeAttribute('data-contrast');
  if(s.reduceMotion)h.setAttribute('data-motion','reduce');else h.removeAttribute('data-motion');
};
reduceMotion={get matches(){return matchMedia('(prefers-reduced-motion: reduce)').matches||!!S.settings.reduceMotion}};

/* ---------- feeds from follow sets ---------- */
var _feedItems=feedItems;
feedItems=function(f){
  if(f.src==='set'){var st=S.sets.filter(function(x){return x.id===f.set})[0],m=st?setMembers(st):[];
    return topNotes().filter(function(n){return m.indexOf(n.author)>=0&&!isMutedNote(n)}).map(function(n){return {n:n,t:n.t}}).sort(function(a,b){return a.t-b.t})}
  return _feedItems(f);
};
SOURCES.set='Follow set';

/* ---------- blurhash reveal after render ---------- */
var _renderFn=render;
render=function(){
  buildNostrMap();
  _renderFn();
  $$('.mbox.is-blur').forEach(function(el){var k=el.dataset.mk;if(S.blurDone.has(k)){el.classList.remove('is-blur');return}
    setTimeout(function(){S.blurDone.add(k);$$('.mbox[data-mk="'+k+'"]').forEach(function(x){x.classList.remove('is-blur')})},450+Math.random()*700)});
  var top=S.stack[S.stack.length-1];if(!top||top.type!=='live')S.watching=null;
};
buildNostrMap();

/* ---------- edit profile: banner, website, lightning address ---------- */
var _openEditProfile=openEditProfile;
openEditProfile=function(){
  _openEditProfile();var u=U.me;
  var pr=$('.photo-row',layer);
  if(pr)pr.insertAdjacentHTML('afterend','<div class="dk-field"><span class="dk-field__label">Banner</span><div class="pbanner" style="border-radius:14px;'+(u.bannerSrc?'background-image:url('+u.bannerSrc+')':'background:linear-gradient(160deg,var(--'+u.tone+'),var(--surface))')+'"></div><div class="btnrow"><button type="button" class="dk-btn dk-btn--secondary dk-btn--sm" data-act="banner-pick">'+ic('image')+(u.bannerSrc?'Change banner':'Add banner')+'</button></div></div>');
  var nf=$('#pf-nip05',layer);
  if(nf)nf.closest('.dk-field').insertAdjacentHTML('afterend',
    '<div class="dk-field"><label class="dk-field__label" for="pf-web">Website</label><input id="pf-web" value="'+esc(u.website||'')+'" placeholder="example.com" inputmode="url" autocomplete="url"></div>'+
    '<div class="dk-field"><label class="dk-field__label" for="pf-lud">Lightning address</label><input id="pf-lud" value="'+esc(u.lud16||'')+'" placeholder="you@wallet.com" autocomplete="off"><span class="dk-field__help">Where zaps to you are paid. Usually shown in your wallet app.</span></div>');
};
var _actFn2=act;
act=function(k,el,e){
  if(k==='banner-pick'){fileTarget='banner';$('#file').removeAttribute('multiple');$('#file').click();return}
  return _actFn2(k,el,e);
};
/* links inside notes open without opening the thread */
document.addEventListener('click',function(e){if(e.target.closest('a.link,a.preview,.plinks a'))e.stopPropagation()},true);

/* ---------- PWA: service worker, install, share target, nostr: links ---------- */
var installPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installPrompt=e;var top=S.stack[S.stack.length-1];if(top&&top.type==='settings'&&top.id==='app')render()});
window.addEventListener('appinstalled',function(){installPrompt=null;toast('Dusk is installed')});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('./sw.js').then(function(reg){
      reg.addEventListener('updatefound',function(){var w=reg.installing;if(!w)return;
        w.addEventListener('statechange',function(){if(w.state==='installed'&&navigator.serviceWorker.controller)toast('A new version of Dusk is ready',function(){location.reload()})})});
    }).catch(function(){});
  });
}
var _extApp=EXTSET.app;
EXTSET.app=function(){
  var h=_extApp();
  if(installPrompt)h=h.replace(/<div class="row-pad" style="display:grid;gap:12px"><span class="caption">Install Dusk/,'<div class="row-pad" style="display:grid;gap:12px"><button class="dk-btn dk-btn--primary dk-btn--lg" data-act="install">'+ic('download')+'Install Dusk</button><span class="caption">Install Dusk');
  return h;
};
var _actPWA=act;
act=function(k,el,e){
  if(k==='install'){if(!installPrompt)return;installPrompt.prompt();installPrompt.userChoice.then(function(c){installPrompt=null;render();if(c&&c.outcome==='accepted')toast('Installing Dusk')});return}
  return _actPWA(k,el,e);
};
window.addEventListener('online',function(){if(S.settings.offline)return;if(pendingCount())setOffline(false)});
function handleLaunch(){
  var q=new URLSearchParams(location.search),clean=false;
  if(q.has('share')||q.has('text')||q.has('url')){
    var parts=[q.get('title'),q.get('text'),q.get('url')].filter(Boolean),txt=parts.join(' ').trim();
    if(txt)openCompose({text:txt+' ',shared:'another app'});else openCompose({});clean=true;
  }
  if(q.has('nostr')){var v=q.get('nostr');if(!openNostrLink(v))toast('That nostr: link isn\'t one Dusk knows');clean=true}
  if(clean)try{history.replaceState(null,'',location.pathname)}catch(e){}
}
setTimeout(handleLaunch,0);

/* ---------- boot ---------- */
[mq768,mq1100].forEach(function(m){(m.addEventListener?m.addEventListener('change',function(){render()}):m.addListener(function(){render()}))});
matchMedia('(prefers-color-scheme: dark)').addEventListener&&matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applySettings);
applySettings();render();
setTimeout(function(){var n=addIncoming();if(n){n.deleted=true;n.hidden=true;S.incoming.push(n);if(S.tab==='home')render()}},12000);
})();
