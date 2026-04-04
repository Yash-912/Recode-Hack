const url = "https://insight0.vercel.app/api/collect";
const siteId = "cmnjoenvi000004jp2ge44k3j";

async function sendEvent(type, path) {
  const payload = {
    site_id: siteId,
    type: type,
    url: "https://insight0-5vxo.vercel.app" + path,
    ts: Date.now()
  };
  
  await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  console.log("Sent " + type + " to " + path);
}

async function run() {
  await sendEvent('pageview', '/index.html');
  await sendEvent('pageview', '/pricing.html');
  await sendEvent('pageview', '/checkout.html');
  await sendEvent('pageview', '/thank-you.html'); 
  await sendEvent('click', '/thank-you.html');
  console.log('SUCCESS');
}
run();
