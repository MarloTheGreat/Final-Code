// Alert button functionality
document.getElementById('alertButton').addEventListener('click', () => {
    alert('Button clicked!');
    });
    // Fetch data from the server
    fetch('/api/data')
    .then((response) => response.json())
    .then((data) => {
    const dataDiv = document.getElementById('dataDisplay');
    dataDiv.innerHTML = `
    <h2>Data from Server:</h2>
    <p>Message: ${data.message}</p>
    
    <p>Timestamp: ${data.timestamp}</p>
    `;
    })
    .catch((error) => console.error('Error fetching data:', error));
    // Fetch random string from the server
    fetch('/api/random-string')
    .then((response) => response.json())
    .then((data) => {
    const randomStringDiv = document.getElementById('randomStringDisplay');
    randomStringDiv.innerHTML = `
    <h2>Random String from Server:</h2>
    <p>Random String: ${data.randomString}</p>
    <p>Length: ${data.length}</p>
    `;
    })
    .catch((error) => console.error('Error fetching random string:', error));
    // Event listener for generating random string with specified length
    document.getElementById('generateStringButton').addEventListener('click', () => {
    const length = document.getElementById('stringLength').value || 10;
    fetch(`/api/random-string?length=${length}`)
    .then((response) => response.json())
    .then((data) => {
    const userRandomStringDiv = document.getElementById('userRandomStringDisplay');
    if (data.error) {
    userRandomStringDiv.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
    } else {
    userRandomStringDiv.innerHTML = `
    <h3>Your Random String:</h3>
    <p>Random String: ${data.randomString}</p>
    <p>Length: ${data.length}</p>
    `;
    }
    })
    .catch((error) => console.error('Error fetching random string:', error));
    });