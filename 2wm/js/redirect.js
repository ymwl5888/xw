// Client-side HTTPS redirect (external file so CSP can disallow inline scripts)
(function(){
  try {
    var host = location.hostname;
    if (location.protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') {
      location.replace('https://' + location.host + location.pathname + location.search + location.hash);
    }
  } catch (e) {
    // fail silently
  }
})();
