fetch('http://localhost:8080/api/ograf/v1/graphics/alert-widget-material-design')
  .then(res => res.json())
  .then(json => console.log(JSON.stringify(json, null, 2)))
  .catch(err => console.error(err));
