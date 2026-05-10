const bcrypt = require('bcryptjs');
const pool = require('./index');

async function seed() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始插入种子数据...');
    
    await connection.beginTransaction();

    console.log('1. 创建管理员和普通用户...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123456', 10);
    
    await connection.query(
      `INSERT INTO users (username, email, password, role) VALUES 
       ('admin', 'admin@example.com', ?, 'admin'),
       ('user1', 'user1@example.com', ?, 'user'),
       ('user2', 'user2@example.com', ?, 'user')`,
      [adminPassword, userPassword, userPassword]
    );
    console.log('   用户创建完成');

    console.log('2. 创建影院...');
    const [cinemaResult] = await connection.query(
      `INSERT INTO cinemas (name, location) VALUES 
       ('万达影城（中关村店）', '北京市海淀区中关村大街27号'),
       ('CGV影城（朝阳大悦城店）', '北京市朝阳区朝阳北路101号'),
       ('金逸影城（国贸店）', '北京市朝阳区建国门外大街1号')`
    );
    const cinemaId1 = cinemaResult.insertId;
    const cinemaId2 = cinemaResult.insertId + 1;
    const cinemaId3 = cinemaResult.insertId + 2;
    console.log('   影院创建完成');

    console.log('3. 创建影厅和座位...');
    const halls = [
      { cinema_id: cinemaId1, name: '1号巨幕厅', rows: 8, cols: 10 },
      { cinema_id: cinemaId1, name: '2号IMAX厅', rows: 10, cols: 12 },
      { cinema_id: cinemaId2, name: 'A厅', rows: 6, cols: 8 },
      { cinema_id: cinemaId2, name: 'B厅', rows: 8, cols: 10 },
      { cinema_id: cinemaId3, name: 'VIP厅', rows: 5, cols: 6 },
      { cinema_id: cinemaId3, name: '豪华厅', rows: 7, cols: 9 }
    ];

    for (const hall of halls) {
      const [hallResult] = await connection.query(
        'INSERT INTO halls (cinema_id, name, rows_count, cols_count) VALUES (?, ?, ?, ?)',
        [hall.cinema_id, hall.name, hall.rows, hall.cols]
      );
      const hallId = hallResult.insertId;

      const seatValues = [];
      for (let row = 1; row <= hall.rows; row++) {
        for (let col = 1; col <= hall.cols; col++) {
          const isVip = row <= 2;
          seatValues.push([hallId, row, col, isVip ? 'vip' : 'normal', true]);
        }
      }
      
      await connection.query(
        'INSERT INTO seat_layouts (hall_id, row_number, col_number, seat_type, is_active) VALUES ?',
        [seatValues]
      );
    }
    console.log('   影厅和座位创建完成');

    console.log('4. 获取影厅ID...');
    const [allHalls] = await connection.query('SELECT id FROM halls ORDER BY id');
    const hallIds = allHalls.map(h => h.id);

    console.log('5. 创建电影...');
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];
    const addDays = (date, days) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    const [movieResult] = await connection.query(
      `INSERT INTO movies (title, poster, description, duration, genre, release_date, rating, status) VALUES 
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?),
       (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        '流浪地球3', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sci-fi%20movie%20poster%20wandering%20earth%20space%20earth&image_size=portrait_4_3', 
        '太阳即将毁灭，人类在地球表面建造出巨大的推进器，寻找新的家园。然而宇宙之路危机四伏，为了拯救地球，流浪地球时代的年轻人再次挺身而出，展开争分夺秒的生死之战。',
        173, '科幻/冒险', formatDate(today), 9.2, 'showing',
        
        '封神第三部', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=chinese%20mythology%20movie%20poster%20fengshen%20gods%20warriors&image_size=portrait_4_3',
        '商王殷寿与狐妖妲己勾结，暴虐无道，引发天谴。昆仑仙人姜子牙携"封神榜"下山，寻找天下共主，以救苍生。',
        148, '神话/动作', formatDate(addDays(today, -7)), 8.9, 'showing',
        
        '速度与激情11', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fast%20and%20furious%20movie%20poster%20cars%20racing%20action&image_size=portrait_4_3',
        '多米尼克·托雷托与他的家人必须面对一位新的敌人，这个对手将利用多姆过去的罪行来摧毁他所爱的一切。',
        141, '动作/犯罪', formatDate(addDays(today, -14)), 8.5, 'showing',
        
        '冰雪奇缘3', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=frozen%20movie%20poster%20elsa%20anna%20ice%20magic%20disney&image_size=portrait_4_3',
        '艾莎和安娜踏上新的冒险之旅，探索艾尔莎魔法的起源，并发现关于他们家族过去的惊人真相。',
        115, '动画/奇幻', formatDate(addDays(today, 7)), 0, 'coming_soon',
        
        '复仇者联盟：秘密战争', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=avengers%20marvel%20movie%20poster%20superheroes%20battle&image_size=portrait_4_3',
        '漫威宇宙最宏大的故事篇章，来自不同维度的英雄们必须联手对抗来自超越者的威胁。',
        180, '科幻/动作', formatDate(addDays(today, 30)), 0, 'coming_soon',
        
        '无间道4', 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=hong%20kong%20crime%20thriller%20movie%20poster%20infernal%20affairs&image_size=portrait_4_3',
        '新一代的卧底警察和黑帮卧底在香港的犯罪世界中展开新一轮的猫鼠游戏。',
        130, '犯罪/剧情', formatDate(addDays(today, -30)), 8.8, 'ended'
      ]
    );

    const movieId1 = movieResult.insertId;
    const movieId2 = movieResult.insertId + 1;
    const movieId3 = movieResult.insertId + 2;
    console.log('   电影创建完成');

    console.log('6. 创建场次...');
    const formatDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:00`;
    };

    const addMinutes = (date, minutes) => {
      const result = new Date(date);
      result.setMinutes(result.getMinutes() + minutes);
      return result;
    };

    const showtimes = [
      { movie_id: movieId1, hall_id: hallIds[0], hour: 10, duration: 173, price: 58 },
      { movie_id: movieId1, hall_id: hallIds[0], hour: 14, duration: 173, price: 68 },
      { movie_id: movieId1, hall_id: hallIds[1], hour: 19, duration: 173, price: 88 },
      { movie_id: movieId1, hall_id: hallIds[1], hour: 22, duration: 173, price: 78 },
      
      { movie_id: movieId2, hall_id: hallIds[2], hour: 11, duration: 148, price: 48 },
      { movie_id: movieId2, hall_id: hallIds[2], hour: 15, duration: 148, price: 58 },
      { movie_id: movieId2, hall_id: hallIds[3], hour: 19, duration: 148, price: 68 },
      { movie_id: movieId2, hall_id: hallIds[3], hour: 22, duration: 148, price: 58 },
      
      { movie_id: movieId3, hall_id: hallIds[4], hour: 12, duration: 141, price: 128 },
      { movie_id: movieId3, hall_id: hallIds[4], hour: 16, duration: 141, price: 128 },
      { movie_id: movieId3, hall_id: hallIds[5], hour: 20, duration: 141, price: 98 },
      { movie_id: movieId3, hall_id: hallIds[5], hour: 23, duration: 141, price: 88 }
    ];

    for (const st of showtimes) {
      const today = new Date();
      const startTime = new Date(today);
      startTime.setHours(st.hour, 0, 0, 0);
      const endTime = addMinutes(startTime, st.duration + 30);

      await connection.query(
        'INSERT INTO showtimes (movie_id, hall_id, start_time, end_time, ticket_price) VALUES (?, ?, ?, ?, ?)',
        [st.movie_id, st.hall_id, formatDateTime(startTime), formatDateTime(endTime), st.price]
      );

      const tomorrow = addDays(today, 1);
      const tomorrowStart = new Date(tomorrow);
      tomorrowStart.setHours(st.hour, 0, 0, 0);
      const tomorrowEnd = addMinutes(tomorrowStart, st.duration + 30);

      await connection.query(
        'INSERT INTO showtimes (movie_id, hall_id, start_time, end_time, ticket_price) VALUES (?, ?, ?, ?, ?)',
        [st.movie_id, st.hall_id, formatDateTime(tomorrowStart), formatDateTime(tomorrowEnd), st.price]
      );
    }
    console.log('   场次创建完成');

    await connection.commit();
    console.log('\n✅ 种子数据插入成功！');
    console.log('\n测试账号：');
    console.log('  管理员: admin / admin123');
    console.log('  普通用户: user1 / user123456');
    console.log('  普通用户: user2 / user123456');

  } catch (error) {
    await connection.rollback();
    console.error('种子数据插入失败:', error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

seed();
