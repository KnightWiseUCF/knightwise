/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

DROP TABLE IF EXISTS `AnswerText`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `AnswerText` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `QUESTION_ID` int DEFAULT NULL,
  `IS_CORRECT_ANSWER` tinyint(1) DEFAULT NULL,
  `TEXT` text,
  `RANK` int DEFAULT NULL,
  `PLACEMENT` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `QUESTION_ID` (`QUESTION_ID`),
  CONSTRAINT `AnswerText_ibfk_1` FOREIGN KEY (`QUESTION_ID`) REFERENCES `Question` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=789 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `EmailCode`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EmailCode` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `EMAIL` varchar(255) NOT NULL,
  `OTP` varchar(6) NOT NULL,
  `EXPIRES` datetime NOT NULL,
  `IS_VERIFIED` tinyint(1) DEFAULT '0',
  `CREATED_AT` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `EMAIL` (`EMAIL`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `Follower`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Follower` (
  `FOLLOWER_ID` int NOT NULL,
  `FOLLOWING_ID` int NOT NULL,
  PRIMARY KEY (`FOLLOWER_ID`,`FOLLOWING_ID`),
  KEY `FOLLOWING_ID` (`FOLLOWING_ID`),
  CONSTRAINT `Follower_ibfk_1` FOREIGN KEY (`FOLLOWER_ID`) REFERENCES `User` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `Follower_ibfk_2` FOREIGN KEY (`FOLLOWING_ID`) REFERENCES `User` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `Guild`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Guild` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `NAME` varchar(50) NOT NULL,
  `OWNER_ID` int NOT NULL,
  `LIFETIME_EXP` double NOT NULL DEFAULT '0',
  `WEEKLY_EXP` double NOT NULL DEFAULT '0',
  `COINS` double NOT NULL DEFAULT '0',
  `DAILY_EXP` double NOT NULL DEFAULT '0',
  `ESTABLISHED` datetime DEFAULT CURRENT_TIMESTAMP,
  `IS_OPEN` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `NAME` (`NAME`),
  UNIQUE KEY `OWNER_ID` (`OWNER_ID`),
  CONSTRAINT `Guild_ibfk_1` FOREIGN KEY (`OWNER_ID`) REFERENCES `User` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `GuildEntry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GuildEntry` (
  `USER_ID` int NOT NULL,
  `GUILD_ID` int NOT NULL,
  `TYPE` enum('Invite','Request') NOT NULL,
  PRIMARY KEY (`USER_ID`,`GUILD_ID`),
  KEY `GUILD_ID` (`GUILD_ID`),
  CONSTRAINT `GuildEntry_ibfk_1` FOREIGN KEY (`USER_ID`) REFERENCES `User` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `GuildEntry_ibfk_2` FOREIGN KEY (`GUILD_ID`) REFERENCES `Guild` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `GuildMember`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GuildMember` (
  `USER_ID` int NOT NULL,
  `GUILD_ID` int NOT NULL,
  `ROLE` enum('Member','Officer','Owner') NOT NULL,
  `COINS_CONTRIBUTED` double NOT NULL DEFAULT '0',
  `JOINED` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`USER_ID`,`GUILD_ID`),
  UNIQUE KEY `USER_ID` (`USER_ID`),
  KEY `GUILD_ID` (`GUILD_ID`),
  CONSTRAINT `GuildMember_ibfk_1` FOREIGN KEY (`USER_ID`) REFERENCES `User` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `GuildMember_ibfk_2` FOREIGN KEY (`GUILD_ID`) REFERENCES `Guild` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `GuildUnlock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `GuildUnlock` (
  `GUILD_ID` int NOT NULL,
  `ITEM_ID` int NOT NULL,
  `IS_EQUIPPED` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`GUILD_ID`,`ITEM_ID`),
  KEY `ITEM_ID` (`ITEM_ID`),
  CONSTRAINT `GuildUnlock_ibfk_1` FOREIGN KEY (`ITEM_ID`) REFERENCES `StoreItem` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `GuildUnlock_ibfk_2` FOREIGN KEY (`GUILD_ID`) REFERENCES `Guild` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `Purchase`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Purchase` (
  `USER_ID` int NOT NULL,
  `ITEM_ID` int NOT NULL,
  `IS_EQUIPPED` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`USER_ID`,`ITEM_ID`),
  KEY `USER_ID` (`USER_ID`) USING BTREE,
  KEY `ITEM_ID` (`ITEM_ID`) USING BTREE,
  CONSTRAINT `Purchased_Item` FOREIGN KEY (`ITEM_ID`) REFERENCES `StoreItem` (`ID`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `Purchaser` FOREIGN KEY (`USER_ID`) REFERENCES `User` (`ID`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `Question`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Question` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `TYPE` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `AUTHOR_EXAM_ID` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SECTION` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CATEGORY` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `SUBCATEGORY` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `POINTS_POSSIBLE` decimal(5,2) DEFAULT NULL,
  `QUESTION_TEXT` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `OWNER_ID` int DEFAULT NULL,
  `IS_PUBLISHED` smallint NOT NULL DEFAULT '1',
  PRIMARY KEY (`ID`) USING BTREE,
  KEY `FK_Question_Owner` (`OWNER_ID`) USING BTREE,
  CONSTRAINT `Question_ibfk_1` FOREIGN KEY (`OWNER_ID`) REFERENCES `User` (`ID`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=213 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `Response`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Response` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `USERID` int DEFAULT NULL,
  `PROBLEM_ID` int DEFAULT NULL,
  `USER_ANSWER` text,
  `DATETIME` datetime DEFAULT CURRENT_TIMESTAMP,
  `ISCORRECT` tinyint(1) DEFAULT NULL,
  `CATEGORY` varchar(100) DEFAULT NULL,
  `TOPIC` varchar(100) DEFAULT NULL,
  `POINTS_EARNED` decimal(5,2) DEFAULT NULL,
  `POINTS_POSSIBLE` decimal(5,2) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `USERID` (`USERID`),
  KEY `PROBLEM_ID` (`PROBLEM_ID`),
  CONSTRAINT `Response_ibfk_1` FOREIGN KEY (`USERID`) REFERENCES `User` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `Response_ibfk_2` FOREIGN KEY (`PROBLEM_ID`) REFERENCES `Question` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=856 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `StoreItem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StoreItem` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `TYPE` enum('flair','profile_picture','background') NOT NULL,
  `COST` decimal(10,2) NOT NULL,
  `NAME` varchar(50) NOT NULL,
  `IS_GUILD_ITEM` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `TestCase`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TestCase` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `QUESTION_ID` int NOT NULL,
  `INPUT` text,
  `EXPECTED_OUTPUT` text NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `idx_question_id` (`QUESTION_ID`),
  CONSTRAINT `TestCase_ibfk_1` FOREIGN KEY (`QUESTION_ID`) REFERENCES `Question` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `TestRun`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TestRun` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `USERID` int NOT NULL,
  `QUESTION_ID` int NOT NULL,
  `DATETIME` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  KEY `USERID` (`USERID`),
  KEY `PROBLEM_ID` (`QUESTION_ID`),
  CONSTRAINT `TestRun_ibfk_1` FOREIGN KEY (`USERID`) REFERENCES `User` (`ID`) ON DELETE CASCADE,
  CONSTRAINT `TestRun_ibfk_2` FOREIGN KEY (`QUESTION_ID`) REFERENCES `Question` (`ID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `PASSWORD` varchar(255) NOT NULL,
  `EMAIL` varchar(255) NOT NULL,
  `FIRSTNAME` varchar(100) DEFAULT NULL,
  `LASTNAME` varchar(100) DEFAULT NULL,
  `USERNAME` varchar(255) DEFAULT NULL,
  `VERIFIED` tinyint(1) NOT NULL DEFAULT '0',
  `IS_PROF` tinyint(1) NOT NULL DEFAULT '0',
  `LIFETIME_EXP` double NOT NULL DEFAULT '0',
  `WEEKLY_EXP` double NOT NULL DEFAULT '0',
  `COINS` double NOT NULL DEFAULT '0',
  `DAILY_EXP` double NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `EMAIL` (`EMAIL`)
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
