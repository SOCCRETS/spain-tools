/* ───────────────── PARTICLES ───────────────── */

(function () {
    const canvas = document.getElementById("particles");
    const ctx = canvas.getContext("2d");

    let W, H;
    let particles = [];
    let animationId;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    const COLORS = [
        "rgba(192,38,211,",
        "rgba(168,85,247,",
        "rgba(6,182,212,",
        "rgba(232,121,249,"
    ];

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * W;
            this.y = Math.random() * H;

            this.vx = (Math.random() - .5) * .3;
            this.vy = (Math.random() - .5) * .3 - .1;

            this.r = Math.random() * 1.5 + .5;

            this.alpha = Math.random() * .4 + .1;

            this.color =
                COLORS[
                    Math.floor(
                        Math.random() *
                        COLORS.length
                    )
                ];

            this.life = 0;
            this.maxLife =
                250 +
                Math.random() * 250;
        }

        update() {

            this.x += this.vx;
            this.y += this.vy;
            this.life++;

            if (
                this.life > this.maxLife ||
                this.x < -50 ||
                this.x > W + 50 ||
                this.y < -50 ||
                this.y > H + 50
            ) {
                this.reset();
            }

        }

        draw() {

            const fade =
                this.life < 30
                    ? this.life / 30
                    : this.life >
                      this.maxLife - 30
                    ? (this.maxLife - this.life) / 30
                    : 1;

            ctx.beginPath();

            ctx.arc(
                this.x,
                this.y,
                this.r,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                this.color +
                (this.alpha * fade) +
                ")";

            ctx.fill();

        }

    }

    for(let i=0;i<90;i++){
        particles.push(
            new Particle()
        );
    }

    function animate(){

        ctx.clearRect(
            0,
            0,
            W,
            H
        );

        particles.forEach(p=>{
            p.update();
            p.draw();
        });

        animationId =
        requestAnimationFrame(
            animate
        );

    }

    animate();

    document.addEventListener(
        "visibilitychange",
        ()=>{

            if(document.hidden){

                cancelAnimationFrame(
                    animationId
                );

            }else{

                animate();

            }

        }
    );

})();


/* ───────────────── TICKER ───────────────── */

(function(){

const items=[

"Premium Script Executor",
"Anti-Detection Layer",
"Advanced ESP",
"Aim Assist Pro",
"Speed Modifier",
"Flight Module",
"GUI Injector",
"Server Protector",
"Admin Suite",
"Real-Time Updates",
"v2.0 Live Now",
"12K+ Members"

];

const track =
document.getElementById(
"tickerTrack"
);

[...items,...items]
.forEach(item=>{

const el=
document.createElement(
"div"
);

el.className=
"ticker-item";

el.innerHTML=`
<span class="dot"></span>
${item}
`;

track.appendChild(el);

});

})();


/* ───────────────── URL PREVIEW ───────────────── */

const SITE_URL =
"https://spain-tools.vercel.app";

function updateSlotsUrl(){

const dir=
document
.getElementById(
"sf-dirName"
)
.value
.trim() ||
"sPAINTools";

document
.getElementById(
"slotsAutoUrl"
)
.textContent=
`${SITE_URL}/${dir}`;

}


/* ───────────────── HELPERS ───────────────── */

function setStatus(
btn,
msg,
color="#7070a0"
){

let status=
btn.parentElement
.querySelector(
".gen-status"
);

if(!status){

status=
document.createElement(
"div"
);

status.className=
"gen-status";

status.style.cssText=`
margin-top:12px;
font-size:.7rem;
font-family:Orbitron,sans-serif;
text-align:center;
letter-spacing:.06em;
min-height:20px;
`;

btn.parentElement
.appendChild(
status
);

}

status.style.color=
color;

status.textContent=
msg;

}

function flashField(
id,
color=
"rgba(192,38,211,.5)"
){

const field=
document.getElementById(
id
);

field.style.borderColor=
color;

field.style.boxShadow=
`0 0 0 3px rgba(192,38,211,.1)`;

field.focus();

setTimeout(()=>{

field.style.borderColor=
"";

field.style.boxShadow=
"";

},2500);

}


/* ───────────────── GENERATE ───────────────── */

async function handleGenerate(){

const dirName=
document
.getElementById(
"sf-dirName"
)
.value.trim();

const dispName=
document
.getElementById(
"sf-dispName"
)
.value.trim();

const charUrl=
document
.getElementById(
"sf-charUrl"
)
.value.trim();

const webhook=
document
.getElementById(
"sf-webhook"
)
.value.trim();

const btn=
document.querySelector(
".slots-generate-btn"
);

if(!dirName){

flashField(
"sf-dirName"
);

setStatus(
btn,
"⚠ Directory Name required",
"#f472b6"
);

return;

}

if(!webhook){

flashField(
"sf-webhook"
);

setStatus(
btn,
"⚠ Webhook required",
"#f472b6"
);

return;

}

const original=
btn.innerHTML;

btn.disabled=true;
btn.textContent=
"Checking...";

setStatus(
btn,
""
);

try{

const response=
await fetch(
"/api/claim",
{
method:"POST",
headers:{
"Content-Type":
"application/json"
},
body:JSON.stringify({

name:dirName,
displayName:dispName,
webhook,
charUrl

})
}
);

const data=
await response.json();

if(data.taken){

flashField(
"sf-dirName"
);

setStatus(
btn,
`✗ "${dirName}" already exists`,
"#f472b6"
);

}

else if(
data.success
){

document
.getElementById(
"slotsAutoUrl"
)
.textContent=
data.url;

btn.textContent=
"✓ Claimed";

btn.style.background=
"linear-gradient(135deg,#16a34a,#22c55e)";

setStatus(
btn,
`✓ ${data.url}`,
"#4ade80"
);

setTimeout(()=>{

btn.innerHTML=
original;

btn.style.background=
"";

},3000);

}

else{

setStatus(
btn,
`✗ ${
data.error ||
"Unknown error"
}`,
"#f472b6"
);

}

}
catch{

setStatus(
btn,
"✗ Network Error",
"#f472b6"
);

}
finally{

btn.disabled=false;

if(
!btn.textContent
.includes(
"Claimed"
)
){

btn.innerHTML=
original;

}

}

}


/* ───────────────── COUNTERS ───────────────── */

function animateCounters(){

document
.querySelectorAll(
".stat-num[data-target]"
)
.forEach(el=>{

const target=
+el.dataset.target;

const suffix=
el.dataset.suffix
|| "";

const duration=
2000;

const start=
performance.now();

function update(now){

const progress=
Math.min(
(now-start)
/
duration,
1
);

const eased=
1-
Math.pow(
1-progress,
3
);

const value=
Math.round(
target*
eased
);

el.textContent=

target>=1000
?

(value>=1000
?
(value/1000)
.toFixed(1)
+"K+"
:
value+"+"
)

:

value+suffix;

if(
progress<1
){

requestAnimationFrame(
update
);

}

}

requestAnimationFrame(
update
);

});

}

const observer=
new IntersectionObserver(

entries=>{

entries.forEach(
entry=>{

if(
entry.isIntersecting
){

animateCounters();

observer.disconnect();

}

});

},
{
threshold:.5
}

);

const community=
document.querySelector(
".community"
);

if(
community
){

observer.observe(
community
);

}


/* ───────────────── PARALLAX FIX ───────────────── */

document.addEventListener(
"mousemove",
e=>{

const x=
(
e.clientX/
window.innerWidth
-.5
)*2;

const y=
(
e.clientY/
window.innerHeight
-.5
)*2;

document
.querySelectorAll(
".roblox-char"
)
.forEach(
(char,i)=>{

const depth=
(i%3+1)*6;

char.style.setProperty(
"--mx",
`${x*depth}px`
);

char.style.setProperty(
"--my",
`${y*depth}px`
);

});

});



/* ───────────────── FOOTER YEAR ───────────────── */

const year=
document.getElementById(
"year"
);

if(year){

year.textContent=
new Date()
.getFullYear();

}
