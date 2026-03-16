export default async function Home() {
  // Nembak ke service backend di dalem Kubernetes nanti
  // Kalau testing lokal, ganti jadi http://localhost:8080/api/hello
  let message = "Loading...";
  try {
    const res = await fetch('http://backend-api-svc:8080/api/hello', { cache: 'no-store' });
    const data = await res.json();
    message = data.message;
  } catch (error) {
    message = "Gagal konek ke Backend :(";
  }

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>
      <h1>Frontend Sanditel Web</h1>
      <p>Status Backend: <strong>{message}</strong></p>
    </div>
  );
}
