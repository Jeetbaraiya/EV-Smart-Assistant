import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import './Home.css';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    AOS.init({
      duration: 1000,
      delay: 100,
      easing: 'ease-out-cubic',
      once: true,
      offset: 50
    });
  }, []);
  return (
    <div className="home">
      <div className="hero">
        <div className="hero-content">
          <div className="hero-badge" data-aos="fade-down" data-aos-delay="0">
            <span className="badge-icon">🌱</span>
            <span>Sustainable Transportation</span>
          </div>
          <h1 data-aos="fade-up" data-aos-delay="200">
            <span className="gradient-text">EV Smart Route</span>
            <br />
            <span className="highlight">& Charging Assistant</span>
          </h1>
          <p className="hero-subtitle" data-aos="fade-up" data-aos-delay="400">
            Experience the future of electric vehicle travel with intelligent route planning, 
            precise range calculations, and verified charging station networks.
          </p>
          <div className="hero-stats" data-aos="fade-up" data-aos-delay="600">
            <div className="stat" data-aos="zoom-in" data-aos-delay="700">
              <div className="stat-number">45+</div>
              <div className="stat-label1">Verified Stations</div>
            </div>
            <div className="stat" data-aos="zoom-in" data-aos-delay="800">
              <div className="stat-number">98%</div>
              <div className="stat-label1">Accuracy Rate</div>
            </div>
            <div className="stat" data-aos="zoom-in" data-aos-delay="900">
              <div className="stat-number">24/7</div>
              <div className="stat-label1">Support</div>
            </div>
          </div>
          <div className="hero-buttons" data-aos="fade-up" data-aos-delay="1000">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="btn btn-primary" data-aos="slide-right" data-aos-delay="1100">
                  <span className="btn-icon">🔋</span>
                  Calculate Range
                </Link>
                <Link to="/login" className="btn btn-secondary" data-aos="slide-left" data-aos-delay="1200">
                  <span className="btn-icon">🗺️</span>
                  Check Route
                </Link>
              </>
            ) : (
              <>
                <Link to="/calculator/range" className="btn btn-primary" data-aos="slide-right" data-aos-delay="1100">
                  <span className="btn-icon">🔋</span>
                  Calculate Range
                </Link>
                <Link to="/calculator/route-check" className="btn btn-secondary" data-aos="slide-left" data-aos-delay="1200">
                  <span className="btn-icon">🗺️</span>
                  Check Route
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hero-visual" data-aos="fade-left" data-aos-delay="500">
          {/* Live Battery Widget */}
          <div className="battery-widget-container" data-aos="zoom-in-up" data-aos-delay="1000">
            <div className="battery-widget-header">
              <span className="car-name">Tesla Model 3</span>
              <span className="status-badge pulse">Charging</span>
            </div>
            
            <div className="battery-graphic">
              <div className="battery-level-fill"></div>
              <div className="battery-percentage">68%</div>
            </div>

            <div className="battery-stats">
              <div className="b-stat">
                <span className="b-label">Range</span>
                <span className="b-val">340 km</span>
              </div>
              <div className="b-stat">
                <span className="b-label">Time to full</span>
                <span className="b-val">45 min</span>
              </div>
            </div>
          </div>

          <div className="floating-card minimal-card" data-aos="fade-up" data-aos-delay="1400">
            <div className="card-icon">📍</div>
            <div className="card-content">
              <div className="card-title">Nearest Hub</div>
              <div className="card-subtitle">2.4 km away</div>
            </div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <div className="container">
          <div className="section-header" data-aos="fade-up">
            <h2>Powerful Features for Smart EV Travel</h2>
            <p>Everything you need to make your electric vehicle journey smooth and efficient</p>
          </div>
          
          <div className="features">
            <div className="feature-card" data-aos="fade-up" data-aos-delay="100">
              <div className="feature-header">
                <div className="feature-icon">🔋</div>
                <h3>Intelligent Range Calculator</h3>
              </div>
              <p>Get precise range estimates based on your vehicle's battery status, driving conditions, and real-world efficiency data.</p>
              <div className="feature-highlights">
                <span className="highlight-tag">AI-Powered</span>
                <span className="highlight-tag">Real-time Data</span>
              </div>
              <Link to={isAuthenticated ? "/calculator/range" : "/login"} className="feature-link">
                Try Calculator 
                <span className="link-arrow">→</span>
              </Link>
            </div>

            <div className="feature-card" data-aos="fade-up" data-aos-delay="200">
              <div className="feature-header">
                <div className="feature-icon">🗺️</div>
                <h3>Smart Route Validation</h3>
              </div>
              <p>Instantly verify if your destination is reachable and get recommendations for charging stops along your route.</p>
              <div className="feature-highlights">
                <span className="highlight-tag">Instant Results</span>
                <span className="highlight-tag">Smart Alerts</span>
              </div>
              <Link to={isAuthenticated ? "/calculator/route-check" : "/login"} className="feature-link">
                Check Route 
                <span className="link-arrow">→</span>
              </Link>
            </div>

            <div className="feature-card" data-aos="fade-up" data-aos-delay="300">
              <div className="feature-header">
                <div className="feature-icon">📍</div>
                <h3>Verified Station Network</h3>
              </div>
              <p>Access our curated database of owner-verified charging stations with real-time availability and authentic reviews.</p>
              <div className="feature-highlights">
                <span className="highlight-tag">Owner Verified</span>
                <span className="highlight-tag">Live Status</span>
              </div>
              <Link to={isAuthenticated ? "/stations" : "/login"} className="feature-link">
                Browse Stations 
                <span className="link-arrow">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="map-preview-section">
        <div className="container">
          <div className="map-preview-header" data-aos="fade-up">
            <h2>Interactive Route Planning</h2>
            <p>Seamlessly discover stations along your journey with our map-centric view.</p>
          </div>
          <div className="map-preview-window" data-aos="zoom-in" data-aos-delay="200">
            {/* Styled via CSS to look like a map UI overlay */}
            <div className="map-ui-overlay">
              <div className="map-ui-searchbar">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Where to, EV driver?" disabled />
                <button className="btn-go">Go</button>
              </div>
              <div className="map-ui-pin pin-origin">📍</div>
              <div className="map-ui-route-line"></div>
              <div className="map-ui-pin pin-dest">🏁</div>
              <div className="map-ui-station station-1">⚡</div>
              <div className="map-ui-station station-2">⚡</div>

              <div className="map-ui-bottom-sheet">
                <div className="sheet-header">
                  <h4>Recommended Stops</h4>
                  <span className="badge-fast">Fast Chargers</span>
                </div>
                <div className="sheet-list">
                  <div className="sheet-item">
                    <span className="item-icon">🔌</span>
                    <div className="item-details">
                      <strong>EcoCharge Hub</strong>
                      <span>~45 mins • 120kW</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="workflow-section">
        <div className="container">
          <div className="section-header" data-aos="fade-up">
            <h2>How It Works</h2>
            <p>Three simple steps to optimize your EV journey</p>
          </div>
          
          <div className="workflow">
            <div className="workflow-step" data-aos="fade-right" data-aos-delay="100">
              <div className="step-visual">
                <div className="step-number" data-aos="zoom-in" data-aos-delay="200">1</div>
                <div className="step-connector"></div>
              </div>
              <div className="step-content">
                <h4>Input Your Details</h4>
                <p>Enter your current battery level, vehicle specifications, and destination to get started with personalized calculations.</p>
              </div>
            </div>
            
            <div className="workflow-step" data-aos="fade-left" data-aos-delay="300">
              <div className="step-visual">
                <div className="step-number" data-aos="zoom-in" data-aos-delay="400">2</div>
                <div className="step-connector"></div>
              </div>
              <div className="step-content">
                <h4>Get Smart Analysis</h4>
                <p>Our AI analyzes your data against real-world conditions to provide accurate range estimates and route feasibility.</p>
              </div>
            </div>
            
            <div className="workflow-step" data-aos="fade-right" data-aos-delay="500">
              <div className="step-visual">
                <div className="step-number" data-aos="zoom-in" data-aos-delay="600">3</div>
              </div>
              <div className="step-content">
                <h4>Travel with Confidence</h4>
                <p>Follow our recommendations and find verified charging stations to ensure a smooth and stress-free journey.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <div className="container">
          <div className="cta-content" data-aos="fade-up">
            <h2 data-aos="fade-up" data-aos-delay="100">Ready to Start Your Smart EV Journey?</h2>
            <p data-aos="fade-up" data-aos-delay="200">Join thousands of EV owners who trust our platform for reliable travel planning</p>
            <div className="cta-buttons" data-aos="fade-up" data-aos-delay="300">
              <Link to={isAuthenticated ? "/calculator/range" : "/login"} className="btn btn-primary btn-large" data-aos="slide-right" data-aos-delay="400">
                Get Started Now
              </Link>
              <Link to={isAuthenticated ? "/stations" : "/login"} className="btn btn-outline btn-large" data-aos="slide-left" data-aos-delay="500">
                Explore Stations
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
