/*
  Add dbo.User table to back OAuth login entitlements.
  Email -> AppMode ('read-only' | 'update' | 'administrator').
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.User', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.[User] (
    UserID INT IDENTITY(1,1) NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    DisplayName NVARCHAR(255) NULL,
    AppMode NVARCHAR(20) NOT NULL CONSTRAINT DF_User_AppMode DEFAULT ('read-only'),
    CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_User_CreatedDate DEFAULT (SYSUTCDATETIME()),
    LastLoginDate DATETIME2 NULL,
    CONSTRAINT PK_User PRIMARY KEY (UserID),
    CONSTRAINT UQ_User_Email UNIQUE (Email)
  );
END;

COMMIT TRANSACTION;

SELECT OBJECT_ID('dbo.User', 'U') AS UserObjectId;
