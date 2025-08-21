import mysql from 'mysql2/promise';

let pool: any | null = null;

export function getPool(): any | null {
	if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
		return null;
	}
	if (!pool) {
		pool = mysql.createPool({
			host: process.env.DB_HOST,
			user: process.env.DB_USER,
			password: process.env.DB_PASS || undefined,
			database: process.env.DB_NAME,
			port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
			connectionLimit: 5,
			charset: 'utf8mb4_unicode_ci',
		});
	}
	return pool;
}

export async function ensureSchema(): Promise<void> {
	const p = getPool();
	if (!p) return;
	await p.execute(`
		CREATE TABLE IF NOT EXISTS faqs (
			id VARCHAR(64) PRIMARY KEY,
			guild_id VARCHAR(32) NOT NULL,
			title VARCHAR(255) NOT NULL,
			question TEXT NOT NULL,
			answer TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_guild (guild_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	await p.execute(`
		CREATE TABLE IF NOT EXISTS registration_settings (
			guild_id VARCHAR(32) PRIMARY KEY,
			register_channel_id VARCHAR(32) NULL,
			review_channel_id VARCHAR(32) NULL,
			allowed_role_ids TEXT NULL,
			registered_role_id VARCHAR(32) NULL,
			new_member_role_id VARCHAR(32) NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	// Şema yükseltmeleri (varsa): registered_role_id kolonu yoksa ekle
	try {
		const result = await p.execute(
			`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
			 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'registration_settings' AND COLUMN_NAME = 'registered_role_id'`,
			[process.env.DB_NAME]
		);
		const [rows] = result as unknown as [any[]];
		const exists = (rows && rows[0] && Number(rows[0].cnt) > 0);
		if (!exists) {
			await p.execute('ALTER TABLE registration_settings ADD COLUMN registered_role_id VARCHAR(32) NULL');
		}
	} catch (e) {
		// Bilgilendirme için logla ama uygulamayı durdurma
		console.warn('registration_settings kolon kontrolü/ekleme başarısız:', e);
	}

	// new_member_role_id kolonu yoksa ekle
	try {
		const result2 = await p.execute(
			`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
			 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'registration_settings' AND COLUMN_NAME = 'new_member_role_id'`,
			[process.env.DB_NAME]
		);
		const [rows2] = result2 as unknown as [any[]];
		const exists2 = (rows2 && rows2[0] && Number(rows2[0].cnt) > 0);
		if (!exists2) {
			await p.execute('ALTER TABLE registration_settings ADD COLUMN new_member_role_id VARCHAR(32) NULL');
		}
	} catch (e) {
		console.warn('registration_settings new_member_role_id ekleme kontrolü başarısız:', e);
	}

	// review_channel_id kolonu yoksa ekle
	try {
		const result3 = await p.execute(
			`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
			 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'registration_settings' AND COLUMN_NAME = 'review_channel_id'`,
			[process.env.DB_NAME]
		);
		const [rows3] = result3 as unknown as [any[]];
		const exists3 = (rows3 && rows3[0] && Number(rows3[0].cnt) > 0);
		if (!exists3) {
			await p.execute('ALTER TABLE registration_settings ADD COLUMN review_channel_id VARCHAR(32) NULL');
		}
	} catch (e) {
		console.warn('registration_settings review_channel_id ekleme kontrolü başarısız:', e);
	}

	await p.execute(`
		CREATE TABLE IF NOT EXISTS registration_modal_fields (
			id VARCHAR(64) PRIMARY KEY,
			guild_id VARCHAR(32) NOT NULL,
			custom_id VARCHAR(64) NOT NULL,
			label VARCHAR(100) NOT NULL,
			style ENUM('short','paragraph') NOT NULL DEFAULT 'short',
			required TINYINT(1) NOT NULL DEFAULT 1,
			placeholder VARCHAR(100) NULL,
			min_length INT NULL,
			max_length INT NULL,
			sort_order INT NOT NULL DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_guild (guild_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	await p.execute(`
		CREATE TABLE IF NOT EXISTS registration_submissions (
			id VARCHAR(64) PRIMARY KEY,
			guild_id VARCHAR(32) NOT NULL,
			user_id VARCHAR(32) NOT NULL,
			payload JSON NOT NULL,
			status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
			approved_by VARCHAR(32) NULL,
			rejected_by VARCHAR(32) NULL,
			reject_reason TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			INDEX idx_guild_user (guild_id, user_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	// Warn sistemi tabloları
	await p.execute(`
		CREATE TABLE IF NOT EXISTS warn_settings (
			guild_id VARCHAR(32) PRIMARY KEY,
			log_channel_id VARCHAR(32) NULL,
			allowed_role_ids TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	await p.execute(`
		CREATE TABLE IF NOT EXISTS warns (
			id VARCHAR(64) PRIMARY KEY,
			guild_id VARCHAR(32) NOT NULL,
			user_id VARCHAR(32) NOT NULL,
			moderator_id VARCHAR(32) NOT NULL,
			reason TEXT NULL,
			image_url TEXT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_guild_user (guild_id, user_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	// warns.image_url kolonu yoksa ekle
	try {
		const [rows] = (await p.execute(
			`SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
			 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'warns' AND COLUMN_NAME = 'image_url'`,
			[process.env.DB_NAME]
		)) as unknown as [any[]];
		const exists = rows && rows[0] && Number(rows[0].cnt) > 0;
		if (!exists) {
			await p.execute('ALTER TABLE warns ADD COLUMN image_url TEXT NULL');
		}
	} catch {}

	// Level sistemi tabloları
	await p.execute(`
		CREATE TABLE IF NOT EXISTS levels_settings (
			guild_id VARCHAR(32) PRIMARY KEY,
			enabled TINYINT(1) NOT NULL DEFAULT 0,
			announce_channel_id VARCHAR(32) NULL,
			cooldown_sec INT NOT NULL DEFAULT 60,
			min_chars INT NOT NULL DEFAULT 60,
			min_words INT NOT NULL DEFAULT 5,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	await p.execute(`
		CREATE TABLE IF NOT EXISTS levels_users (
			guild_id VARCHAR(32) NOT NULL,
			user_id VARCHAR(32) NOT NULL,
			xp_total BIGINT NOT NULL DEFAULT 0,
			level INT NOT NULL DEFAULT 0,
			last_xp_at TIMESTAMP NULL,
			PRIMARY KEY (guild_id, user_id),
			INDEX idx_guild_xp (guild_id, xp_total),
			INDEX idx_guild_level (guild_id, level)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);

	// Release notları tablosu
	await p.execute(`
		CREATE TABLE IF NOT EXISTS release_notes (
			id VARCHAR(64) PRIMARY KEY,
			guild_id VARCHAR(32) NULL,
			version VARCHAR(32) NOT NULL,
			title VARCHAR(255) NULL,
			body TEXT NOT NULL,
			created_by VARCHAR(32) NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			INDEX idx_version (version),
			INDEX idx_created_at (created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
	`);
}


