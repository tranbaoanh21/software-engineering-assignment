import './vehicle-visual.css';

const photoSource = 'https://commons.wikimedia.org/wiki/File:Newone_-_black_VinFast_Klara_S_04.jpg';

export function VehiclePlate({ code }: { code: string }) {
  return <span className="vehicle-plate">
    <span className="vehicle-plate__mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false"><use href="/design/metrics.svg#vehicle" /></svg>
    </span>
    <strong>{code}</strong>
  </span>;
}

export function SharedVehicleSummary({ code, hubName, status }: {
  code: string; hubName: string; status?: string;
}) {
  return <div className="vehicle-summary">
    <figure className="vehicle-summary__photo">
      <img src="/design/shared-electric-scooter.webp" width={960} height={540} alt="" decoding="async" />
      <figcaption><a href={photoSource} target="_blank" rel="noreferrer"
        title="Newone · CC BY-SA 4.0">Ảnh minh họa</a></figcaption>
    </figure>
    <div className="vehicle-summary__details">
      <span className="vehicle-summary__label">Mã xe dùng chung</span>
      <h2><VehiclePlate code={code} /></h2>
      <p>{hubName}</p>
      {status && <span className="status-pill" data-tone="info">{status}</span>}
    </div>
  </div>;
}
