import "./Home.css";

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];

export default function Home({ onSelect }) {
  return (
    <div className="home">
      <img src="/f1-logo.png" alt="F1 Logo" className="logo" />

      <h1 className="home-title">
      <span className="f1-text">Formula 1</span> <span className="data-text">Data 🏁</span>
</h1>


      <div className="year-row" role="group" aria-label="Season years">
        {YEARS.map((y) => (
          <button
            key={y}
            onClick={() => onSelect(y)}
            className={`year-btn ${y === 2018 ? "active" : ""}`}
          >
            {y}
          </button>
        ))}
      </div>
      <section className="legal">
  <p>
    This site is an **unofficial Formula 1® project** and is not affiliated with Formula One Management.  
    F1®, FORMULA 1®, FORMULA ONE WORLD CHAMPIONSHIP™ and related marks are trademarks of Formula One Licensing B.V.
  </p>
  <p>
    All race data and statistics are referenced from official Formula 1® sources.  
    Please refer to <a href="https://www.formula1.com" target="_blank" rel="noreferrer">F1.com</a> for official records.
  </p>
</section>

    </div>
  );
}
