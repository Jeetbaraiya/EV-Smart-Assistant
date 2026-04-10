const db = require('../config/database');

const seedBookings = async () => {
    try {
        await db.init();
        const conn = db.getDb();

        console.log('-> Fetching stations...');
        conn.all('SELECT id, owner_id, price_per_kw FROM charging_stations', async (err, stations) => {
            if (err) throw err;
            if (!stations || stations.length === 0) {
                console.log('No stations found to seed bookings for.');
                process.exit(0);
            }

            console.log(`-> Generating bookings for ${stations.length} stations...`);
            
            const bookings = [];
            const now = new Date();
            
            // Generate ~150-200 bookings
            for (let i = 0; i < 180; i++) {
                const station = stations[Math.floor(Math.random() * stations.length)];
                const daysAgo = Math.floor(Math.random() * 30);
                const hoursAgo = Math.floor(Math.random() * 24);
                
                const startTime = new Date(now);
                startTime.setDate(now.getDate() - daysAgo);
                startTime.setHours(now.getHours() - hoursAgo);
                
                const durationMinutes = 30 + Math.floor(Math.random() * 120);
                const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
                
                const energyConsumed = 10 + Math.floor(Math.random() * 60); // 10-70 kWh
                const pricePerKw = station.price_per_kw || 15;
                const totalPrice = energyConsumed * pricePerKw;
                
                // 90% completed, 10% pending/cancelled
                const statusRand = Math.random();
                let status = 'completed';
                if (statusRand > 0.95) status = 'cancelled';
                else if (statusRand > 0.9) status = 'pending';

                bookings.push([
                    station.id,
                    null, // user_id (anonymous or random)
                    startTime.toISOString().slice(0, 19).replace('T', ' '),
                    endTime.toISOString().slice(0, 19).replace('T', ' '),
                    energyConsumed,
                    totalPrice,
                    status
                ]);
            }

            console.log(`-> Inserting ${bookings.length} bookings...`);
            
            let inserted = 0;
            for (const b of bookings) {
                conn.run(
                    `INSERT INTO bookings (station_id, user_id, start_time, end_time, energy_kwh, total_price, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    b,
                    function(err) {
                        if (err) console.error('Error inserting booking:', err);
                        inserted++;
                        if (inserted === bookings.length) {
                            console.log('-> Seeding completed successfully.');
                            process.exit(0);
                        }
                    }
                );
            }
        });
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedBookings();
