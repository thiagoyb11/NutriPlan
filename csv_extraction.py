import pandas as pd

folder_legacy = 'FoodData_Central_sr_legacy_food_csv_2018-04'
folder_foundation = 'FoodData_Central_foundation_food_csv_2026-04-30'

df_legacy = pd.read_csv(folder_legacy + '/food_attribute.csv')
df_foundation = pd.read_csv(folder_foundation + '/food_nutrient.csv')


df_legacy.name.isna().sum()
