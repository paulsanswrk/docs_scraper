fetch('https://www.bitunix.com/api-docs/spots/en_us/')
  .then(res => res.text())
  .then(html => {
      const match = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi);
      console.log('Total a tags:', match ? match.length : 0);
      if (match) {
          console.log(match.slice(0, 20).join('\n'));
      }
  })
  .catch(console.error);
