const dbConfig = require('../config/database');

const stationsData = [
  { id: 1, name: 'Statiq Charging Station - Connaught Place', address: 'Connaught Place', city: 'New Delhi', state: 'Delhi', zip_code: '110001', latitude: 28.6304, longitude: 77.2177, connector_type: 'CCS2', power_kw: 50, price_per_kw: 14.6, owner_id: 3 },
  { id: 2, name: 'Tata Power EV Charging - Bandra', address: 'Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', zip_code: '400051', latitude: 19.0596, longitude: 72.8295, connector_type: 'Type 2', power_kw: 30, price_per_kw: 17.5, owner_id: 3 },
  { id: 3, name: 'Ather Grid - Koramangala', address: 'Koramangala 5th Block', city: 'Bangalore', state: 'Karnataka', zip_code: '560095', latitude: 12.9352, longitude: 77.6245, connector_type: 'CCS2', power_kw: 25, price_per_kw: 21.8, owner_id: 3 },
  { id: 4, name: 'Magenta Charging - Hitech City', address: 'Hitech City', city: 'Hyderabad', state: 'Telangana', zip_code: '500081', latitude: 17.4486, longitude: 78.3908, connector_type: 'Bharat DC-001', power_kw: 50, price_per_kw: 14.6, owner_id: 3 },
  { id: 5, name: 'ChargeZone - Salt Lake', address: 'Sector V, Salt Lake', city: 'Kolkata', state: 'West Bengal', zip_code: '700091', latitude: 22.5726, longitude: 88.3639, connector_type: 'CCS2', power_kw: 60, price_per_kw: 15.6, owner_id: 3 },
  { id: 6, name: 'EESL Charging Station - MG Road', address: 'MG Road', city: 'Pune', state: 'Maharashtra', zip_code: '411001', latitude: 18.5204, longitude: 73.8567, connector_type: 'Type 2', power_kw: 15, price_per_kw: 12.1, owner_id: 3 },
  { id: 7, name: 'Fortum Charge & Drive - Noida', address: 'Sector 18, Noida', city: 'Noida', state: 'Uttar Pradesh', zip_code: '201301', latitude: 28.5355, longitude: 77.391, connector_type: 'CCS2', power_kw: 50, price_per_kw: 21.7, owner_id: 3 },
  { id: 8, name: 'EV Plugs - Whitefield', address: 'Whitefield', city: 'Bangalore', state: 'Karnataka', zip_code: '560066', latitude: 12.9698, longitude: 77.7499, connector_type: 'Type 2', power_kw: 22, price_per_kw: 20.1, owner_id: 3 },
  { id: 9, name: 'ABB Charging - Gurgaon', address: 'DLF Cyber City', city: 'Gurgaon', state: 'Haryana', zip_code: '122002', latitude: 28.4962, longitude: 77.0884, connector_type: 'CCS2', power_kw: 50, price_per_kw: 13.7, owner_id: 3 },
  { id: 10, name: 'Zeon Charging - Chennai', address: 'T Nagar', city: 'Chennai', state: 'Tamil Nadu', zip_code: '600017', latitude: 13.0475, longitude: 80.2409, connector_type: 'Bharat DC-001', power_kw: 30, price_per_kw: 16, owner_id: 3 },
  { id: 11, name: 'Statiq Charging - Vasant Kunj', address: 'Vasant Kunj', city: 'New Delhi', state: 'Delhi', zip_code: '110070', latitude: 28.5245, longitude: 77.1555, connector_type: 'CCS2', power_kw: 50, price_per_kw: 17, owner_id: 3 },
  { id: 12, name: 'Tata Power - Andheri', address: 'Andheri West', city: 'Mumbai', state: 'Maharashtra', zip_code: '400053', latitude: 19.1136, longitude: 72.8697, connector_type: 'Type 2', power_kw: 30, price_per_kw: 14.9, owner_id: 3 },
  { id: 13, name: 'Ather Grid - Indiranagar', address: 'Indiranagar', city: 'Bangalore', state: 'Karnataka', zip_code: '560038', latitude: 12.9784, longitude: 77.6408, connector_type: 'CCS2', power_kw: 25, price_per_kw: 21.7, owner_id: 3 },
  { id: 14, name: 'ChargeZone - Powai', address: 'Powai', city: 'Mumbai', state: 'Maharashtra', zip_code: '400076', latitude: 19.1176, longitude: 72.906, connector_type: 'CCS2', power_kw: 60, price_per_kw: 21.6, owner_id: 3 },
  { id: 15, name: 'Magenta Charging - Banjara Hills', address: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', zip_code: '500034', latitude: 17.4239, longitude: 78.4738, connector_type: 'Bharat DC-001', power_kw: 50, price_per_kw: 21.1, owner_id: 3 },
  { id: 16, name: 'EESL Charging - Vashi', address: 'Vashi', city: 'Navi Mumbai', state: 'Maharashtra', zip_code: '400703', latitude: 19.0791, longitude: 72.998, connector_type: 'Type 2', power_kw: 15, price_per_kw: 18.6, owner_id: 4 },
  { id: 17, name: 'Fortum Charge - Greater Noida', address: 'Greater Noida', city: 'Greater Noida', state: 'Uttar Pradesh', zip_code: '201310', latitude: 28.4744, longitude: 77.504, connector_type: 'CCS2', power_kw: 50, price_per_kw: 17.7, owner_id: 4 },
  { id: 18, name: 'ABB Charging - Manesar', address: 'Manesar', city: 'Gurgaon', state: 'Haryana', zip_code: '122050', latitude: 28.3544, longitude: 77.0125, connector_type: 'CCS2', power_kw: 50, price_per_kw: 20.9, owner_id: 4 },
  { id: 19, name: 'Statiq Charging - Sector 29', address: 'Sector 29', city: 'Gurgaon', state: 'Haryana', zip_code: '122001', latitude: 28.4595, longitude: 77.0266, connector_type: 'CCS2', power_kw: 50, price_per_kw: 19.1, owner_id: 4 },
  { id: 20, name: 'Tata Power - Electronic City', address: 'Electronic City', city: 'Bangalore', state: 'Karnataka', zip_code: '560100', latitude: 12.8456, longitude: 77.6633, connector_type: 'Type 2', power_kw: 30, price_per_kw: 21.1, owner_id: 4 },
  { id: 21, name: 'ChargeZone - Hinjewadi', address: 'Hinjewadi', city: 'Pune', state: 'Maharashtra', zip_code: '411057', latitude: 18.5912, longitude: 73.7389, connector_type: 'CCS2', power_kw: 60, price_per_kw: 16, owner_id: 4 },
  { id: 22, name: 'Ather Grid - HSR Layout', address: 'HSR Layout', city: 'Bangalore', state: 'Karnataka', zip_code: '560102', latitude: 12.912, longitude: 77.6446, connector_type: 'CCS2', power_kw: 25, price_per_kw: 14.7, owner_id: 4 },
  { id: 23, name: 'Magenta Charging - Gachibowli', address: 'Gachibowli', city: 'Hyderabad', state: 'Telangana', zip_code: '500032', latitude: 17.4229, longitude: 78.3498, connector_type: 'Bharat DC-001', power_kw: 50, price_per_kw: 13.7, owner_id: 4 },
  { id: 24, name: 'EESL Charging - Salt Lake Sector 1', address: 'Sector 1, Salt Lake', city: 'Kolkata', state: 'West Bengal', zip_code: '700064', latitude: 22.5749, longitude: 88.4059, connector_type: 'Type 2', power_kw: 15, price_per_kw: 12.5, owner_id: 4 },
  { id: 25, name: 'Zeon Charging - Adyar', address: 'Adyar', city: 'Chennai', state: 'Tamil Nadu', zip_code: '600020', latitude: 13.0067, longitude: 80.2206, connector_type: 'Bharat DC-001', power_kw: 30, price_per_kw: 19.2, owner_id: 4 },
  { id: 26, name: 'Statiq Charging - Dwarka', address: 'Dwarka Sector 10', city: 'New Delhi', state: 'Delhi', zip_code: '110075', latitude: 28.5844, longitude: 77.0478, connector_type: 'CCS2', power_kw: 50, price_per_kw: 16.6, owner_id: 4 },
  { id: 27, name: 'Tata Power - Thane', address: 'Thane West', city: 'Thane', state: 'Maharashtra', zip_code: '400601', latitude: 19.2183, longitude: 72.9781, connector_type: 'Type 2', power_kw: 30, price_per_kw: 13.2, owner_id: 4 },
  { id: 28, name: 'ChargeZone - Coimbatore', address: 'RS Puram', city: 'Coimbatore', state: 'Tamil Nadu', zip_code: '641002', latitude: 11.0168, longitude: 76.9558, connector_type: 'CCS2', power_kw: 60, price_per_kw: 14.2, owner_id: 4 },
  { id: 29, name: 'Ather Grid - Marathahalli', address: 'Marathahalli', city: 'Bangalore', state: 'Karnataka', zip_code: '560037', latitude: 12.9592, longitude: 77.6974, connector_type: 'CCS2', power_kw: 25, price_per_kw: 19.3, owner_id: 4 },
  { id: 30, name: 'Fortum Charge - Faridabad', address: 'Sector 15, Faridabad', city: 'Faridabad', state: 'Haryana', zip_code: '121007', latitude: 28.4089, longitude: 77.3178, connector_type: 'CCS2', power_kw: 50, price_per_kw: 12.2, owner_id: 4 },
  { id: 31, name: 'Statiq Charging - Ahmedabad', address: 'SG Highway', city: 'Ahmedabad', state: 'Gujarat', zip_code: '380054', latitude: 23.0225, longitude: 72.5714, connector_type: 'CCS2', power_kw: 50, price_per_kw: 21.1, owner_id: 5 },
  { id: 32, name: 'Tata Power EV Charging - Surat', address: 'Adajan', city: 'Surat', state: 'Gujarat', zip_code: '395009', latitude: 21.1702, longitude: 72.8311, connector_type: 'Type 2', power_kw: 30, price_per_kw: 16.9, owner_id: 5 },
  { id: 33, name: 'ChargeZone - Vadodara', address: 'Alkapuri', city: 'Vadodara', state: 'Gujarat', zip_code: '390007', latitude: 22.3072, longitude: 73.1812, connector_type: 'CCS2', power_kw: 60, price_per_kw: 19.3, owner_id: 5 },
  { id: 34, name: 'EESL Charging Station - Rajkot', address: 'Race Course Road', city: 'Rajkot', state: 'Gujarat', zip_code: '360001', latitude: 22.3039, longitude: 70.8022, connector_type: 'Type 2', power_kw: 15, price_per_kw: 13.7, owner_id: 5 },
  { id: 35, name: 'Magenta Charging - Gandhinagar', address: 'Sector 21', city: 'Gandhinagar', state: 'Gujarat', zip_code: '382021', latitude: 23.2156, longitude: 72.6369, connector_type: 'Bharat DC-001', power_kw: 50, price_per_kw: 18.7, owner_id: 5 },
  { id: 36, name: 'Statiq Charging - Bhavnagar', address: 'Waghawadi Road', city: 'Bhavnagar', state: 'Gujarat', zip_code: '364001', latitude: 21.7645, longitude: 72.1519, connector_type: 'CCS2', power_kw: 50, price_per_kw: 20.2, owner_id: 5 },
  { id: 37, name: 'Tata Power - Jamnagar', address: 'Bedipara', city: 'Jamnagar', state: 'Gujarat', zip_code: '361001', latitude: 22.4707, longitude: 70.0587, connector_type: 'Type 2', power_kw: 30, price_per_kw: 12.8, owner_id: 5 },
  { id: 38, name: 'ChargeZone - Anand', address: 'Vallabh Vidyanagar', city: 'Anand', state: 'Gujarat', zip_code: '388120', latitude: 22.5645, longitude: 72.9289, connector_type: 'CCS2', power_kw: 60, price_per_kw: 21.7, owner_id: 5 },
  { id: 39, name: 'Ather Grid - Ahmedabad', address: 'Prahladnagar', city: 'Ahmedabad', state: 'Gujarat', zip_code: '380015', latitude: 23.0330, longitude: 72.5063, connector_type: 'CCS2', power_kw: 25, price_per_kw: 17.8, owner_id: 5 },
  { id: 40, name: 'Statiq Charging - Surat', address: 'Vesu', city: 'Surat', state: 'Gujarat', zip_code: '395007', latitude: 21.1619, longitude: 72.7707, connector_type: 'CCS2', power_kw: 50, price_per_kw: 12.2, owner_id: 5 },
  { id: 41, name: 'EESL Charging - Vadodara', address: 'Sayajigunj', city: 'Vadodara', state: 'Gujarat', zip_code: '390005', latitude: 22.3100, longitude: 73.1808, connector_type: 'Type 2', power_kw: 15, price_per_kw: 15.6, owner_id: 5 },
  { id: 42, name: 'Fortum Charge & Drive - Ahmedabad', address: 'Satellite', city: 'Ahmedabad', state: 'Gujarat', zip_code: '380015', latitude: 23.0267, longitude: 72.5126, connector_type: 'CCS2', power_kw: 50, price_per_kw: 19.4, owner_id: 5 },
  { id: 43, name: 'ABB Charging - Surat', address: 'Piplod', city: 'Surat', state: 'Gujarat', zip_code: '395007', latitude: 21.1702, longitude: 72.7904, connector_type: 'CCS2', power_kw: 50, price_per_kw: 18.1, owner_id: 5 },
  { id: 44, name: 'ChargeZone - Mehsana', address: 'Mehsana City', city: 'Mehsana', state: 'Gujarat', zip_code: '384001', latitude: 23.5880, longitude: 72.3693, connector_type: 'CCS2', power_kw: 60, price_per_kw: 20.3, owner_id: 5 },
  { id: 45, name: 'Tata Power - Bharuch', address: 'Bharuch City', city: 'Bharuch', state: 'Gujarat', zip_code: '392001', latitude: 21.7051, longitude: 72.9959, connector_type: 'Type 2', power_kw: 30, price_per_kw: 15.3, owner_id: 5 }
];

async function seed() {
  try {
    await dbConfig.init();
    const db = dbConfig.getDb();
    
    console.log('Starting sync of 45 Indian stations (id-aware)...');
    
    // Clear old ones first to avoid ID conflicts if they were added via auto-increment before
    // We only clear the range we are about to re-insert or identify by name
    await new Promise((resolve) => {
        db.run('DELETE FROM charging_stations WHERE id BETWEEN 1 AND 45 OR id > 67', [], () => resolve());
    });

    for (const station of stationsData) {
      const sql = `
        REPLACE INTO charging_stations 
        (id, name, address, city, state, zip_code, latitude, longitude, connector_type, power_kw, price_per_kw, availability, owner_id, is_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        station.id,
        station.name,
        station.address,
        station.city,
        station.state,
        station.zip_code,
        station.latitude,
        station.longitude,
        station.connector_type,
        station.power_kw,
        station.price_per_kw,
        'available',
        station.owner_id,
        1 // verified
      ];
      
      await new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) {
            console.error(`Error inserting station ${station.name}:`, err.message);
            reject(err);
          } else {
            // Also ensure a connector exists for this station
            db.run('REPLACE INTO connectors (station_id, type, power, price_per_kwh, status) VALUES (?, ?, ?, ?, "available")', 
                [station.id, station.connector_type, station.power_kw, station.price_per_kw || 15.0], 
                () => resolve()
            );
          }
        });
      });
    }
    
    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
