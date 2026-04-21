import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiDownload } from "react-icons/fi";
import { FaBox, FaCreditCard, FaChartBar, FaUserCog, FaBuilding, FaDollarSign, FaBolt, FaClipboardList, FaLock, FaPhone, FaMapMarkerAlt, FaEnvelope } from "react-icons/fa";
// ── DATA ──────────────────────────────────────────────────────────────────────

const features = [
  { icon: <FaBuilding />, title: "11-Branch Overview", desc: "One dashboard showing live status, orders across all 1  locations simultaneously." },
  { icon: <FaBox />, title: "Order Status Overview", desc: "View which orders are paid and unpaid across all branches from the admin panel." },
  { icon: <FaCreditCard />, title: "Transaction Records", desc: "All transactions across every branch flow into one place, no manual reconciliation needed." },
  { icon: <FaChartBar />, title: "Branch Analytics", desc: "Compare branch performance side-by-side. Spot what's working and what needs attention instantly." },
  { icon: <FaUserCog />, title: "Staff Management", desc: "Monitor clerk transactions at each branch through the admin panel." },
  {
    icon: <FaDollarSign />, title: "Update Pricing", desc: "Admin can propose price changes instantly"
  }
];

const steps = [
  { num: "01", title: "Log In as Admin", desc: "Access PapaJ with the dedicated single-admin credentials." },
  { num: "02", title: "Pick a Branch", desc: "Navigate to any of the 11 branches to see its full operational view." },
  { num: "03", title: "Manage Operations", desc: "Review orders, monitor clerk, and monitor payments from one screen." },
  { num: "04", title: "Check Branch Summaries", desc: "Generate simple cross-branch reports showing paid and unpaid orders, as well as clerk activity, to monitor performance" },
];

const screenshots = [
  "Branch Overview", "Order Details", "Staff Panel", "Analytics", "Payments",
];

const benefits = [
  { icon: <FaBuilding />, title: "One App for All 11 Branches", desc: "Designed from scratch for this specific multi-branch operation" },
  { icon: <FaBolt />, title: "Faster, Clearer Decisions", desc: "Consolidated data means the admin never has to chase information across different sheets or calls." },
  { icon: <FaClipboardList />, title: "Centralized Records", desc: "Every order, payment, and customer note lives in one secure." },
  { icon: <FaLock />, title: "Built Exclusively for This Business", desc: "PapaJ was built for one owner and their specific workflow" },
];

const team = [
  {
    name: "Farwenda Ancheta",
    role: "Project Manager",
    bio: "Leads the PapaJ team, coordinating development, design, and delivery to ensure projects run smoothly."
  },
  {
    name: "Shadia Lagoyo",
    role: "UI/UX Designer",
    bio: "Designed every screen in PapaJ with a focus on clarity,  built for an admin who needs to move fast."
  },
  {
    name: "Amani Uri",
    role: "Business Analyst",
    bio: "Analyzes business requirements and ensures features align with goals and user needs."
  },
  {
    name: "Dharelle Ebol",
    role: "Full-Stack Developer",
    bio: "Built the API, backend, and frontend architecture that powers real-time updates across all 11 branches."
  },
  {
    name: "Joshua Granada",
    role: "QA",
    bio: "Ensures every feature is tested across devices before launch and manages ongoing production quality."
  }
];

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export default function PapaJWebsite() {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Sticky nav shadow on scroll
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);

    // Scroll-reveal via IntersectionObserver
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      obs.disconnect();
    };
  }, []);

  return (
    <>
      {/* ── NAV ── */}
      <nav className={scrolled ? "scrolled" : ""}>
        <a className="nav-brand" href="#hero">
          <div className="nav-icon">
            <img src="logo.png" alt="PapaJ Logo" style={{ height: "40px" }} />
          </div>
          <span className="nav-name">PapaJ</span>
        </a>
        <ul className="nav-links">
          {["About", "Features", "How It Works", "Screenshots", "Team", "Contact"].map((l) => (
            <li key={l}>
              <a href={`#${l.toLowerCase().replace(/ /g, "-")}`}>{l}</a>
            </li>
          ))}
          <li><Link to="/login" className="nav-cta">Log In</Link></li>
        </ul>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" id="hero">
        <div className="reveal left">
          <div className="hero-eyebrow">Custom-Built Laundry App</div>
          <h1>Manage All 11 Branches From <em>One App.</em></h1>
          <p className="hero-body">
            PapaJ is a purpose-built mobile application for a single laundry business owner, giving full
            visibility and control over all 11 branches, orders, staff, and revenue from one screen.
          </p>
          <div className="hero-actions">
            {/* link to the download section so the top button behaves the same as the bottom one */}
            <a href="#download" className="btn btn-dark"> <FiDownload />Download the App</a>
          </div>
          <div className="hero-metrics">
            {[["11", "Branches Managed"], ["1 Admin", "Full Control"]].map(([v, l]) => (
              <div key={l}>
                <div className="metric-val">{v}</div>
                <div className="metric-lbl">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-right reveal right">
          <div className="hero-img-box">
            {/* add your real hero image directly; the placeholder styling is only for dev */}
            <img src="homepage.png" alt="PapaJ App" />
          </div>
          <div className="hero-badge">
            <div className="badge-dot" />
            <div>
              <div className="badge-main">System Online</div>
              <div className="badge-sub">All 11 branches connected</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className="sec sec-alt" id="about">
        <div className="about-grid">
          <div className="reveal">
            <div className="sec-tag">About the App</div>
            <h2>A Custom Solution for One Laundry Business</h2>
            <p className="sec-desc" style={{ textAlign: "center", margin: "0 auto" }}>
              PapaJ wasn't pulled off a shelf — it was built specifically around how this business runs.
              One admin. Eleven branches. Zero compromises.
            </p>
            <div className="about-list">
              {[
                "Built exclusively for this laundry operation",
                "Single admin account with full access to all 11 branches",
                "Custom workflows designed around real daily operations",
              ].map((t, i) => (
                <div key={i} className="about-item">
                  <span className="about-num">0{i + 1}</span>
                  <span className="about-text">{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="about-panel reveal right">
            <div className="panel-label">At a glance</div>
            <div className="stat-row">
              {[["11", "Branches"], ["1", "Admin"], ["24/7", "Uptime"]].map(([v, l]) => (
                <div key={l} className="stat-box">
                  <div className="stat-box-val">{v}</div>
                  <div className="stat-box-lbl">{l}</div>
                </div>
              ))}
            </div>
            {[
              ["Order Tracking Accuracy", "96%"],
              ["Admin Time Saved", "80%"],
              ["Branch Visibility", "100%"],
            ].map(([l, v]) => (
              <div key={l} className="bar-item">
                <div className="bar-top"><span>{l}</span><span>{v}</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: v }} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="sec" id="features">
        <div className="feat-head">
          <div className="reveal left">
            <div className="sec-tag">Key Features</div>
            <h2>Every Feature Earns Its Place</h2>
          </div>
        </div>
        <div className="feat-grid">
          {features.map((f, i) => (
            <div key={f.title} className={`feat-card reveal d${(i % 3) + 1}`}>
              <div className="feat-icon">{f.icon}</div>
              <div className="feat-title">{f.title}</div>
              <p className="feat-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="sec" id="how-it-works" style={{ paddingTop: 0 }}>
        <div className="how-box reveal">
          <div className="sec-tag">How It Works</div>
          <h2>Four Steps to Full Control</h2>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s.num} className={`step reveal d${i + 1}`}>
                <div className="step-circle">{s.num}</div>
                <div className="step-title">{s.title}</div>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCREENSHOTS ── */}
      <section className="sec sec-alt" id="screenshots">
        <div className="ss-head">
          <div className="reveal left">
            <div className="sec-tag">Screenshots</div>
            <h2>See PapaJ in Action</h2>
          </div>
          <p className="sec-desc reveal right" style={{ marginBottom: 0 }}>
            Each screen was designed around what the admin actually needs
          </p>
        </div>
        <div className="ss-scroll">
          {screenshots.map((sc, i) => (
            <div key={i} className={`ss-card reveal d${Math.min(i + 1, 5)}`}>
              <img src={`/screen-${i + 1}.jpg`} alt={sc} />
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section className="sec" id="benefits">
        <div className="ben-grid">
          <div>
            <div className="reveal">
              <div className="sec-tag">Benefits</div>
              <h2>Why This Approach Works</h2>
            </div>
            {benefits.map((b) => (
              <div key={b.title} className="ben-row reveal">
                <div className="ben-icon">{b.icon}</div>
                <div>
                  <div className="ben-title">{b.title}</div>
                  <p className="ben-body">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>


        </div>
      </section>

      {/* ── DOWNLOAD ── */}
      <section className="sec" id="download" style={{ paddingTop: 0 }}>
        <div className="dl-wrap reveal">
          <div>
            <h2 style={{ marginBottom: 10 }}>Ready to Use. Just Download &amp; Log In.</h2>
            <p className="dl-sub">
              PapaJ was built for this business. Download the app, sign in with the admin account,
              and every one of your 11 branches is immediately visible.
            </p>
          </div>
          <div className="dl-btns">
            {[
              ["Download the App now"],

            ].map(([icon, sub, name]) => (
              // use a button or real link; prevent default on placeholder to stop scrolling
              <button
                key={name}
                type="button"
                className="store-btn"
                onClick={(e) => e.preventDefault()}
              >
                <div className="store-icon">{icon}</div>
                <div>
                  <span className="store-sub">{sub}</span>
                  <span className="store-name">{name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEAM ── */}
      <section className="sec sec-alt" id="team">
        <div className="team-head reveal">
          <div className="sec-tag">About the Developers</div>
          <h2>The Team That Built PapaJ</h2>
          <p className="sec-desc">
            Our five-person Go Dev team designed, engineered, tested this custom application from scratch for a single client.
          </p>
        </div>
        <div className="team-grid">
          {team.map((m, i) => (
            <div key={m.name} className={`team-card reveal d${i + 1}`}>
              <div className="team-photo">
                {/* Replace placeholder with actual image */}
                <img
                  src={`/team-${i + 1}.jpg`}
                  alt={m.name}
                  className="team-img"
                />
                <div className="team-overlay" />
              </div>
              <div className="team-info">
                <div className="team-name">{m.name}</div>
                <div className="team-role">{m.role}</div>
                <p className="team-bio">{m.bio}</p>
                <div className="team-links">
                  {["in", "fb", "x"].map((s) => (
                    <div key={s} className="team-link">{s}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="sec" id="contact">
        <div className="contact-grid">
          <div className="reveal left">
            <div className="sec-tag">Contact</div>
            <h2>Get in Touch</h2>
            <p className="sec-desc">
              Have questions about PapaJ or want to know more about the project? We're happy to hear from you.
            </p>
            {[
              { icon: <FaEnvelope />, label: "Email", val: "hello@papaj.app" },
              { icon: <FaPhone />, label: "Phone", val: "+63 912 345 6789" },
              { icon: <FaMapMarkerAlt />, label: "Location", val: "Zamboanga City, Philippines" },
            ].map((c) => (
              <div key={c.label} className="c-detail">
                <div className="c-icon">{c.icon}</div>
                <div>
                  <div className="c-label">{c.label}</div>
                  <div className="c-val">{c.val}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="reveal right">
            <div className="form-row">
              <div className="form-field">
                <label>Full Name</label>
                <input
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-field">
                <label>Email Address</label>
                <input
                  placeholder="you@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="form-field">
              <label>Subject</label>
              <input
                placeholder="What's this about?"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>Message</label>
              <textarea
                rows={5}
                placeholder="Your message..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>
            <button className="btn btn-dark" onClick={() => alert("Message sent!")}>
              Send Message →
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-brand">PapaJ</div>
        <p className="footer-copy">© 2026 PapaJ. A custom-built laundry management app.</p>
        <ul className="footer-links">
          {[
            { label: "Privacy", href: "#about" },
            { label: "Terms", href: "#features" },
            { label: "Support", href: "#contact" },
          ].map((l) => (
            <li key={l.label}><a href={l.href}>{l.label}</a></li>
          ))}
        </ul>
      </footer>
    </>
  );
}