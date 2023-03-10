module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {//mysql Users 테이블 생성
        //id가 기본적으로 들어감
        email: {
            type: DataTypes.STRING(20), //STRING, TEXT, BOOLEAN, INTEGER, FLOAT, DATETIME
            allowNull: false, //필수,
            unique: true,
        },
        nickname: {
            type: DataTypes.STRING(30),
            allowNull: false, //필수
        },
        password: {
            type: DataTypes.STRING(100),
            allowNull: false, //필수
        },
    }, {
        modelName: 'User',
        tableName: 'users',
        charset: 'utf8',
        collate: 'utf8_general_ci',
        sequelize,
    });
    User.associate = (db) => {
        db.User.hasMany(db.Post);
        db.User.hasMany(db.Comment);
        db.User.belongsToMany(db.Post, { through : 'Like', as: 'Liked' });
        db.User.belongsToMany(db.User, { through : 'Follow', as: 'Followers', foreignKey: 'FollowingId' });
        db.User.belongsToMany(db.User, { through : 'Follow', as: 'Followings', foreignKey: 'FollowerId' });
    };
    return User;
}