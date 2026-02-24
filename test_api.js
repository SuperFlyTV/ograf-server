fetch('http://localhost:8080/api/ograf/v1/renderers')
  .then(res => res.text())
  .then(text => console.log('Response:', text))
  .catch(err => console.error('Fetch error:', err));
