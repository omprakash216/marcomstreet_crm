-- Migration: Add file support columns to chat_messages
-- Description: Adds file_name and file_type columns which are missing but required by the API

USE marcom_street_crm;

ALTER TABLE chat_messages 
ADD COLUMN file_name VARCHAR(255) DEFAULT NULL AFTER file_path,
ADD COLUMN file_type VARCHAR(100) DEFAULT NULL AFTER file_name;
